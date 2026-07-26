import { useState, useCallback } from "react";
import { generateId, isAbortError, formatTitle, readSSEStream } from "../utils.js";

export default function useAgentChat({
  activeId,
  activeIdRef,
  conversations,
  setConversations,
  setMessages,
  setActiveId,
  loading,
  question,
  setQuestion,
  resolvedModel,
  isBuiltin,
  apiKey,
  customBaseUrl,
  selectedModel,
  snapshotComposer,
  prepareScrollForNewMessage,
  userDetachedRef,
  beginConversationGeneration,
  isConversationGeneration,
  endConversationGeneration,
  error,
  setError,
  retryQuestion,
  setRetryQuestion,
}) {
  const [copiedIdx, setCopiedIdx] = useState(null);

  const getModelBody = useCallback(() => {
    const body = { model: resolvedModel };
    if (!isBuiltin) body.apiKey = apiKey.trim();
    if (resolvedModel === "custom" && customBaseUrl.trim()) {
      body.baseUrl = customBaseUrl.trim();
    } else if (selectedModel.baseUrl) {
      body.baseUrl = selectedModel.baseUrl;
    }
    return body;
  }, [resolvedModel, isBuiltin, apiKey, customBaseUrl, selectedModel]);

  const requireApiKey = useCallback(() => {
    if (!isBuiltin && !apiKey.trim()) {
      setError("请先填写 API Key");
      return false;
    }
    return true;
  }, [isBuiltin, apiKey]);

  const persistMessages = useCallback(
    (targetId, finalMessages, extra = {}) => {
      setConversations((prev) =>
        prev.map((c) =>
          c.id === targetId
            ? {
                ...c,
                messages: finalMessages,
                model: resolvedModel,
                timestamp: Date.now(),
                ...extra,
              }
            : c
        )
      );
      if (activeIdRef.current === targetId) {
        setMessages(finalMessages);
      }
    },
    [setConversations, resolvedModel, activeIdRef, setMessages]
  );

  const cleanupFailedAssistant = useCallback(
    (targetId, baseMessages) => {
      const cleaned = (baseMessages || []).filter(
        (m, i, arr) => !(m.role === "assistant" && !m.content && i === arr.length - 1)
      );
      persistMessages(targetId, cleaned);
    },
    [persistMessages]
  );

  const copyMessage = useCallback(async (content, idx) => {
    try {
      await navigator.clipboard.writeText(content || "");
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx((cur) => (cur === idx ? null : cur)), 1500);
    } catch {
      setError("复制失败，请手动选择文本");
    }
  }, []);

  const runAgentRequest = useCallback(
    async ({ trimmedQuestion, targetId, nextMessages, historyMessages, isRetry }) => {
      const { controller, token } = beginConversationGeneration(targetId);

      if (activeIdRef.current === targetId) {
        setError("");
        setRetryQuestion("");
        if (!isRetry) setQuestion("");
      }

      let streamingMessages = [
        ...nextMessages,
        { role: "assistant", content: "", sources: [], suggestions: [] },
      ];
      persistMessages(targetId, streamingMessages);

      let persistRaf = 0;
      const publishStream = () => {
        persistRaf = 0;
        if (!isConversationGeneration(targetId, token)) return;
        persistMessages(targetId, streamingMessages);
      };

      try {
        const res = await fetch("/api/agent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question: trimmedQuestion,
            history: historyMessages,
            ...getModelBody(),
          }),
          signal: controller.signal,
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "请求失败");
        }

        const { answer, retrieved, suggestions, aborted } = await readSSEStream(res, {
          signal: controller.signal,
          onEvent: ({ answer: partial, retrieved: src, suggestions: nextSuggest }) => {
            if (!isConversationGeneration(targetId, token)) return false;
            streamingMessages = streamingMessages.map((m, i) =>
              i === streamingMessages.length - 1 && m.role === "assistant"
                ? {
                    ...m,
                    content: partial,
                    sources: src?.length ? src : m.sources,
                    suggestions: nextSuggest?.length ? nextSuggest : m.suggestions,
                  }
                : m
            );
            if (!persistRaf) persistRaf = requestAnimationFrame(publishStream);
            return true;
          },
        });

        if (!isConversationGeneration(targetId, token)) return;
        if (persistRaf) {
          cancelAnimationFrame(persistRaf);
          persistRaf = 0;
        }

        const sources = (retrieved || []).filter((s) => s && (s.title || s.sourceUrl));
        const suggestList = (suggestions || []).filter((s) => typeof s === "string" && s.trim());
        let finalMessages = streamingMessages.map((m, i) =>
          i === streamingMessages.length - 1 && m.role === "assistant"
            ? { ...m, content: answer || m.content || "", sources, suggestions: suggestList }
            : m
        );

        if (!answer && !aborted) {
          finalMessages = nextMessages;
        }

        persistMessages(targetId, finalMessages);
        if (aborted && !answer) {
          cleanupFailedAssistant(targetId, nextMessages);
        }
      } catch (err) {
        if (!isConversationGeneration(targetId, token)) return;
        if (isAbortError(err)) {
          const partial = streamingMessages[streamingMessages.length - 1];
          if (partial?.role === "assistant" && partial.content) {
            persistMessages(targetId, streamingMessages);
          } else {
            cleanupFailedAssistant(targetId, nextMessages);
          }
          return;
        }
        cleanupFailedAssistant(targetId, nextMessages);
        if (activeIdRef.current === targetId) {
          setError(err.message || "请求失败");
          setRetryQuestion(trimmedQuestion);
        }
      } finally {
        if (persistRaf) cancelAnimationFrame(persistRaf);
        endConversationGeneration(targetId, token, controller);
      }
    },
    [
      beginConversationGeneration,
      activeIdRef,
      setQuestion,
      persistMessages,
      isConversationGeneration,
      getModelBody,
      cleanupFailedAssistant,
      endConversationGeneration,
    ]
  );

  const submitUserQuestion = useCallback(
    async (rawText, { isRetry = false } = {}) => {
      const trimmedQuestion = String(rawText || "").trim();
      if (!trimmedQuestion || loading) return;
      if (!requireApiKey()) return;

      const timestamp = Date.now();
      const userMessage = { role: "user", content: trimmedQuestion };

      let targetId = activeId;
      let nextMessages;
      let historyMessages;

      const activeConv = conversations.find((c) => c.id === activeId);
      if (!activeConv) {
        targetId = generateId();
        nextMessages = [userMessage];
        historyMessages = [];
        setConversations((prev) => [
          {
            id: targetId,
            title: formatTitle(trimmedQuestion),
            messages: nextMessages,
            model: resolvedModel,
            timestamp,
            pinned: false,
            titleLocked: false,
            composer: snapshotComposer(),
          },
          ...prev,
        ]);
        setActiveId(targetId);
        activeIdRef.current = targetId;
      } else {
        targetId = activeId;
        historyMessages = activeConv.messages;
        nextMessages = [...activeConv.messages, userMessage];
        setConversations((prev) =>
          prev.map((c) =>
            c.id === targetId
              ? {
                  ...c,
                  messages: nextMessages,
                  model: resolvedModel,
                  timestamp,
                  composer: snapshotComposer(),
                  title:
                    c.titleLocked || (c.messages && c.messages.length > 0)
                      ? c.title
                      : formatTitle(trimmedQuestion),
                }
              : c
          )
        );
      }

      prepareScrollForNewMessage(nextMessages);
      userDetachedRef.current = false;
      setMessages(nextMessages);
      await runAgentRequest({
        trimmedQuestion,
        targetId,
        nextMessages,
        historyMessages,
        isRetry,
      });
    },
    [
      loading,
      requireApiKey,
      activeId,
      conversations,
      setConversations,
      resolvedModel,
      snapshotComposer,
      setActiveId,
      activeIdRef,
      prepareScrollForNewMessage,
      userDetachedRef,
      setMessages,
      runAgentRequest,
    ]
  );

  const handleSubmit = useCallback(
    async (e) => {
      e?.preventDefault?.();
      await submitUserQuestion(question);
    },
    [submitUserQuestion, question]
  );

  const handleSuggestQuestion = useCallback(
    (q) => {
      if (loading) return;
      void submitUserQuestion(q);
    },
    [loading, submitUserQuestion]
  );

  const handleRetry = useCallback(async () => {
    if (loading || !retryQuestion) return;
    if (!requireApiKey()) return;

    const trimmedQuestion = retryQuestion;
    const activeConv = conversations.find((c) => c.id === activeId);
    if (!activeConv) {
      setQuestion(trimmedQuestion);
      setRetryQuestion("");
      setError("");
      return;
    }

    let baseMessages = activeConv.messages;
    const last = baseMessages[baseMessages.length - 1];
    if (last?.role === "assistant" && !last.content) {
      baseMessages = baseMessages.slice(0, -1);
    }
    const lastUser = [...baseMessages].reverse().find((m) => m.role === "user");
    let nextMessages = baseMessages;
    if (!lastUser || lastUser.content !== trimmedQuestion) {
      nextMessages = [...baseMessages, { role: "user", content: trimmedQuestion }];
      setConversations((prev) =>
        prev.map((c) => (c.id === activeId ? { ...c, messages: nextMessages, model: resolvedModel } : c))
      );
    }

    const historyMessages = nextMessages.slice(0, -1);
    setMessages(nextMessages);
    setError("");
    await runAgentRequest({
      trimmedQuestion,
      targetId: activeId,
      nextMessages,
      historyMessages,
      isRetry: true,
    });
  }, [
    loading,
    retryQuestion,
    requireApiKey,
    conversations,
    activeId,
    setQuestion,
    setConversations,
    resolvedModel,
    setMessages,
    runAgentRequest,
  ]);

  return {
    copiedIdx,
    getModelBody,
    requireApiKey,
    persistMessages,
    cleanupFailedAssistant,
    copyMessage,
    runAgentRequest,
    submitUserQuestion,
    handleSubmit,
    handleSuggestQuestion,
    handleRetry,
  };
}
