import { useState, useEffect, useRef, useCallback } from "react";
import {
  RESUME_MAX_BYTES,
  RESUME_ACCEPT,
} from "../constants.js";
import {
  generateId,
  isAbortError,
  formatResumeTitle,
  readSSEStream,
  detectResumeKind,
  fileToBase64,
} from "../utils.js";

export default function useResumeFlow({
  activeId,
  activeIdRef,
  conversations,
  setConversations,
  setMessages,
  setActiveId,
  loading,
  resumeMode,
  resumeText,
  setResumeText,
  resumeAttachment,
  setResumeAttachment,
  resumeSessionId,
  setResumeSessionId,
  resumeSelectedIndex,
  setResumeSelectedIndex,
  resolvedModel,
  snapshotComposer,
  prepareScrollForNewMessage,
  userDetachedRef,
  requireApiKey,
  getModelBody,
  persistMessages,
  cleanupFailedAssistant,
  beginConversationGeneration,
  isConversationGeneration,
  endConversationGeneration,
  setError,
  setRetryQuestion,
}) {
  const fileInputRef = useRef(null);
  const resumeChipRef = useRef(null);
  const resumeUploadAbortRef = useRef(null);
  const [resumeChipWidth, setResumeChipWidth] = useState(0);

  const clearResumeAttachment = useCallback(() => {
    if (resumeUploadAbortRef.current) {
      try {
        resumeUploadAbortRef.current.abort();
      } catch {
        // ignore
      }
      resumeUploadAbortRef.current = null;
    }
    setResumeAttachment(null);
    setResumeChipWidth(0);
  }, [setResumeAttachment]);

  useEffect(() => {
    if (!resumeAttachment) {
      setResumeChipWidth(0);
      return undefined;
    }
    if (!resumeMode) return undefined;

    let ro = null;
    let raf = 0;
    const measure = () => {
      const el = resumeChipRef.current;
      if (!el) return;
      const w = el.offsetWidth;
      if (w > 0) setResumeChipWidth(w);
    };

    raf = requestAnimationFrame(() => {
      measure();
      const el = resumeChipRef.current;
      if (!el || typeof ResizeObserver === "undefined") return;
      ro = new ResizeObserver(() => measure());
      ro.observe(el);
    });

    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
    };
  }, [resumeMode, resumeAttachment, resumeAttachment?.status, resumeAttachment?.fileName]);

  const handleResumeFile = useCallback(
    async (e) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file) return;

      let kind;
      try {
        kind = detectResumeKind(file);
      } catch (err) {
        setError(err.message || "不支持的文件类型");
        return;
      }
      if (file.size > RESUME_MAX_BYTES) {
        setError(`文件过大，最大允许 ${RESUME_MAX_BYTES / (1024 * 1024)}MB`);
        return;
      }

      if (resumeUploadAbortRef.current) {
        try {
          resumeUploadAbortRef.current.abort();
        } catch {
          // ignore
        }
      }
      const controller = new AbortController();
      resumeUploadAbortRef.current = controller;

      setError("");
      setResumeAttachment({
        status: "uploading",
        fileName: file.name,
        kind,
      });

      try {
        const fileBase64 = await fileToBase64(file);
        if (controller.signal.aborted) return;

        const res = await fetch("/api/resume-upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: file.name,
            mime: file.type || "",
            fileBase64,
          }),
          signal: controller.signal,
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "上传失败");
        if (controller.signal.aborted) return;

        setResumeAttachment({
          status: "ready",
          fileName: data.fileName || file.name,
          kind: data.kind || kind,
          token: data.token,
        });
      } catch (err) {
        if (isAbortError(err) || controller.signal.aborted) {
          setResumeAttachment(null);
          return;
        }
        setResumeAttachment(null);
        setError(err.message || "上传失败");
      } finally {
        if (resumeUploadAbortRef.current === controller) {
          resumeUploadAbortRef.current = null;
        }
      }
    },
    [setError, setResumeAttachment]
  );

  const handleResumeInterview = useCallback(
    async (e) => {
      e.preventDefault();
      const attachmentReady = resumeAttachment?.status === "ready" && resumeAttachment.token;
      if (resumeAttachment?.status === "uploading") {
        setError("简历仍在上传中，请稍候");
        return;
      }
      if ((!resumeText.trim() && !attachmentReady) || loading) return;
      if (!requireApiKey()) return;

      const rawResume = attachmentReady ? "" : resumeText.trim();
      const content = attachmentReady
        ? `【简历模拟面试】\n\n[简历文件] ${resumeAttachment.fileName}`
        : `【简历模拟面试】\n\n${rawResume}`;
      const timestamp = Date.now();
      const userMessage = { role: "user", content };
      const autoTitle = formatResumeTitle(rawResume, attachmentReady ? resumeAttachment.fileName : "");

      let targetId = activeId;
      let nextMessages;

      const activeConv = conversations.find((c) => c.id === activeId);
      if (!activeConv) {
        targetId = generateId();
        nextMessages = [userMessage];
        setConversations((prev) => [
          {
            id: targetId,
            title: autoTitle,
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
                  title: c.titleLocked ? c.title : autoTitle,
                }
              : c
          )
        );
      }

      prepareScrollForNewMessage(nextMessages);
      userDetachedRef.current = false;
      setMessages(nextMessages);
      setError("");
      setRetryQuestion("");
      setResumeSessionId("");
      const requestBody = {
        ...getModelBody(),
      };
      if (attachmentReady) {
        requestBody.resumeUploadToken = resumeAttachment.token;
        requestBody.fileName = resumeAttachment.fileName;
      } else {
        requestBody.resumeText = resumeText.trim();
      }
      setResumeText("");
      clearResumeAttachment();

      const { controller, token } = beginConversationGeneration(targetId);
      let streamingMessages = [...nextMessages, { role: "assistant", content: "" }];
      persistMessages(targetId, streamingMessages);

      let persistRaf = 0;
      const publishStream = () => {
        persistRaf = 0;
        if (!isConversationGeneration(targetId, token)) return;
        persistMessages(targetId, streamingMessages);
      };

      try {
        const res = await fetch("/api/resume-interview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
          signal: controller.signal,
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "请求失败");
        }

        const { answer, meta, aborted } = await readSSEStream(res, {
          signal: controller.signal,
          onEvent: ({ answer: partial, meta: m }) => {
            if (!isConversationGeneration(targetId, token)) return false;
            if (m?.sessionId || typeof m?.selectedIndex === "number") {
              if (activeIdRef.current === targetId) {
                if (m?.sessionId) setResumeSessionId(m.sessionId);
                if (typeof m?.selectedIndex === "number") setResumeSelectedIndex(m.selectedIndex);
              }
              setConversations((prev) =>
                prev.map((c) =>
                  c.id === targetId
                    ? {
                        ...c,
                        composer: {
                          ...(c.composer || {}),
                          resumeSessionId: m?.sessionId || c.composer?.resumeSessionId || "",
                          resumeSelectedIndex:
                            typeof m?.selectedIndex === "number"
                              ? m.selectedIndex
                              : c.composer?.resumeSelectedIndex || 0,
                        },
                      }
                    : c
                )
              );
            }
            streamingMessages = streamingMessages.map((msg, i) =>
              i === streamingMessages.length - 1 && msg.role === "assistant"
                ? { ...msg, content: partial }
                : msg
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
        if (meta?.sessionId && activeIdRef.current === targetId) setResumeSessionId(meta.sessionId);
        // 固定默认第 1 组
        if (activeIdRef.current === targetId) setResumeSelectedIndex(0);

        const plans = Array.isArray(meta?.plans)
          ? meta.plans.map((p, idx) => ({
              index: typeof p.index === "number" ? p.index : idx,
              label: p.label || `第${idx + 1}组`,
              angle: p.angle || "",
              markdown: p.markdown || "",
            }))
          : [];
        const firstMarkdown = plans[0]?.markdown || answer || "";

        const finalMessages = streamingMessages.map((m, i) =>
          i === streamingMessages.length - 1 && m.role === "assistant"
            ? {
                ...m,
                content: firstMarkdown || m.content || "",
                resumePlans: plans,
                resumePlanIndex: 0,
                resumeRoleLabel: meta?.roleLabel || "",
              }
            : m
        );
        if (!firstMarkdown && aborted) {
          cleanupFailedAssistant(targetId, nextMessages);
        } else {
          persistMessages(targetId, finalMessages);
        }
      } catch (err) {
        if (!isConversationGeneration(targetId, token)) return;
        if (isAbortError(err)) {
          const partial = streamingMessages[streamingMessages.length - 1];
          if (partial?.content) persistMessages(targetId, streamingMessages);
          else cleanupFailedAssistant(targetId, nextMessages);
          return;
        }
        cleanupFailedAssistant(targetId, nextMessages);
        if (activeIdRef.current === targetId) setError(err.message);
      } finally {
        if (persistRaf) cancelAnimationFrame(persistRaf);
        endConversationGeneration(targetId, token, controller);
      }
    },
    [
      resumeAttachment,
      resumeText,
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
      setError,
      setRetryQuestion,
      setResumeSessionId,
      getModelBody,
      setResumeText,
      clearResumeAttachment,
      beginConversationGeneration,
      persistMessages,
      isConversationGeneration,
      setResumeSelectedIndex,
      cleanupFailedAssistant,
      endConversationGeneration,
    ]
  );

  const abortResumeUpload = useCallback(() => {
    if (resumeUploadAbortRef.current) {
      try {
        resumeUploadAbortRef.current.abort();
      } catch {
        // ignore
      }
      resumeUploadAbortRef.current = null;
    }
  }, []);

  return {
    fileInputRef,
    resumeChipRef,
    resumeUploadAbortRef,
    resumeChipWidth,
    setResumeChipWidth,
    clearResumeAttachment,
    handleResumeFile,
    handleResumeInterview,
    abortResumeUpload,
    RESUME_ACCEPT,
  };
}
