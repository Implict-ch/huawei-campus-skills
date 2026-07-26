import {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from "react";
import { Icon } from "../../icons/index.jsx";
import { AGENT_PAGE_CONTENT } from "../../data/hw-app.js";
import {
  HISTORY_KEY,
  ACTIVE_KEY,
  SHOW_MODEL_SETTINGS,
  FORCED_MODEL,
} from "./constants.js";
import {
  loadHistory,
  loadActiveId,
  sortConversations,
  emptyComposer,
  readComposerFromConv,
} from "./history.js";
import AgentImageLightbox from "./markdown/AgentImageLightbox.jsx";
import { createMarkdownComponents } from "./markdown/createMarkdownComponents.jsx";
import AgentSidebar from "./components/AgentSidebar.jsx";
import AgentChatMessages from "./components/AgentChatMessages.jsx";
import AgentComposer from "./components/AgentComposer.jsx";
import useConversationGeneration from "./hooks/useConversationGeneration.js";
import useChatScroll from "./hooks/useChatScroll.js";
import useAgentChat from "./hooks/useAgentChat.js";
import useResumeFlow from "./hooks/useResumeFlow.js";
import { exportResumePlansZip } from "./utils/exportResumePlans.js";

export default function AgentPage() {
  const initialConversations = useMemo(() => loadHistory(), []);
  const [conversations, setConversations] = useState(initialConversations);
  const [activeId, setActiveId] = useState(() => loadActiveId(initialConversations));
  const [messages, setMessages] = useState(() => {
    const id = loadActiveId(initialConversations);
    const conv = initialConversations.find((c) => c.id === id);
    return conv?.messages || [];
  });
  const [model, setModel] = useState(FORCED_MODEL);
  const [customBaseUrl, setCustomBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const resolvedModel = SHOW_MODEL_SETTINGS
    ? model === "deepseek-chat" || model === "deepseek-reasoner"
      ? "deepseek-v4-flash"
      : model
    : FORCED_MODEL;
  const isBuiltin = resolvedModel === "builtin-deepseek";
  const [showKey, setShowKey] = useState(false);
  const [error, setError] = useState("");
  const [retryQuestion, setRetryQuestion] = useState("");
  const [lightbox, setLightbox] = useState(null);
  const openLightbox = useCallback((payload) => {
    if (!payload?.src) return;
    const images =
      Array.isArray(payload.images) && payload.images.length
        ? payload.images
        : [{ src: payload.src, alt: payload.alt || "" }];
    const index =
      typeof payload.index === "number"
        ? payload.index
        : Math.max(
            0,
            images.findIndex((it) => it.src === payload.src)
          );
    setLightbox({ images, index: index >= 0 ? index : 0 });
  }, []);
  const closeLightbox = useCallback(() => setLightbox(null), []);
  const markdownComponents = useMemo(
    () => createMarkdownComponents(openLightbox),
    [openLightbox]
  );
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [question, setQuestion] = useState(() => {
    const id = loadActiveId(initialConversations);
    const fromConv = readComposerFromConv(initialConversations.find((c) => c.id === id));
    try {
      const q = new URLSearchParams(window.location.search).get("q");
      if (q) return q;
    } catch {
      // ignore
    }
    return fromConv.question;
  });
  const [resumeMode, setResumeMode] = useState(() => {
    const id = loadActiveId(initialConversations);
    const fromConv = readComposerFromConv(initialConversations.find((c) => c.id === id));
    try {
      if (new URLSearchParams(window.location.search).get("mode") === "resume") return true;
    } catch {
      // ignore
    }
    return fromConv.resumeMode;
  });
  const [resumeText, setResumeText] = useState(() => {
    const id = loadActiveId(initialConversations);
    return readComposerFromConv(initialConversations.find((c) => c.id === id)).resumeText;
  });
  const [resumeSessionId, setResumeSessionId] = useState(() => {
    const id = loadActiveId(initialConversations);
    return readComposerFromConv(initialConversations.find((c) => c.id === id)).resumeSessionId;
  });
  const [resumeSelectedIndex, setResumeSelectedIndex] = useState(() => {
    const id = loadActiveId(initialConversations);
    return readComposerFromConv(initialConversations.find((c) => c.id === id)).resumeSelectedIndex;
  });
  const [resumeAttachment, setResumeAttachment] = useState(() => {
    const id = loadActiveId(initialConversations);
    return readComposerFromConv(initialConversations.find((c) => c.id === id)).resumeAttachment;
  });
  const [editingId, setEditingId] = useState(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [modelMenuOpen, setModelMenuOpen] = useState(false);

  const selectedModel =
    AGENT_PAGE_CONTENT.models.find((m) => m.value === resolvedModel) || AGENT_PAGE_CONTENT.models[0];
  const renameInputRef = useRef(null);
  const renameWrapRef = useRef(null);
  const modelMenuRef = useRef(null);
  const activeIdRef = useRef(activeId);
  const emptyComposerRef = useRef(emptyComposer());
  const setResumeChipWidthRef = useRef(null);

  const sortedConversations = useMemo(() => sortConversations(conversations), [conversations]);

  const {
    generatingIds,
    loading,
    abortConversation,
    beginConversationGeneration,
    isConversationGeneration,
    endConversationGeneration,
    stopGeneration,
  } = useConversationGeneration(activeId);

  const {
    chatRef,
    chatEndRef,
    topSentinelRef,
    userDetachedRef,
    chatSettling,
    scrollBtnMounted,
    scrollBtnLeaving,
    setScrollBtnMounted,
    setScrollBtnLeaving,
    visibleMessages,
    hasOlderMessages,
    msgStartIndex,
    followStreamHeight,
    beginChatSettle,
    prepareScrollForNewMessage,
    loadOlderMessages,
    scrollToBottom,
    resetVisibleMsgCount,
  } = useChatScroll({ activeId, messages, loading, error });

  const {
    copiedIdx,
    getModelBody,
    requireApiKey,
    persistMessages,
    cleanupFailedAssistant,
    copyMessage,
    handleSubmit,
    handleSuggestQuestion,
    handleRetry,
  } = useAgentChat({
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
  });

  const resumeFlow = useResumeFlow({
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
  });

  setResumeChipWidthRef.current = resumeFlow.setResumeChipWidth;

  const selectResumePlan = useCallback(
    (msgIndex, planIndex) => {
      if (!activeId) return;
      setMessages((prev) => {
        const cur = prev[msgIndex];
        const plan = cur?.resumePlans?.[planIndex];
        if (!cur || !plan?.markdown) return prev;
        const next = prev.map((m, i) =>
          i === msgIndex
            ? {
                ...m,
                resumePlanIndex: planIndex,
                content: plan.markdown,
              }
            : m
        );
        persistMessages(activeId, next);
        return next;
      });
      setResumeSelectedIndex(planIndex);
    },
    [activeId, setMessages, persistMessages, setResumeSelectedIndex]
  );

  const exportResumePlansAt = useCallback(
    async (msgIndex) => {
      const msg = messages[msgIndex];
      const plans = msg?.resumePlans;
      if (!plans?.length) {
        setError("没有可导出的面试题分组");
        return;
      }
      try {
        const result = await exportResumePlansZip({
          plans,
          roleLabel: msg.resumeRoleLabel || "",
        });
        if (result?.mode === "cancelled") return;
      } catch (err) {
        setError(err?.message || "导出失败");
      }
    },
    [messages, setError]
  );

  function snapshotComposer() {
    return {
      resumeMode,
      question,
      resumeText,
      resumeAttachment:
        resumeAttachment?.status === "ready" && resumeAttachment.token
          ? {
              status: "ready",
              fileName: resumeAttachment.fileName,
              kind: resumeAttachment.kind,
              token: resumeAttachment.token,
            }
          : null,
      resumeSessionId,
      resumeSelectedIndex,
    };
  }

  function applyComposer(snap) {
    const next = snap && typeof snap === "object" ? { ...emptyComposer(), ...snap } : emptyComposer();
    setResumeMode(!!next.resumeMode);
    setQuestion(typeof next.question === "string" ? next.question : "");
    setResumeText(typeof next.resumeText === "string" ? next.resumeText : "");
    setResumeAttachment(next.resumeAttachment || null);
    setResumeSessionId(typeof next.resumeSessionId === "string" ? next.resumeSessionId : "");
    setResumeSelectedIndex(Number.isFinite(next.resumeSelectedIndex) ? next.resumeSelectedIndex : 0);
    setResumeChipWidthRef.current?.(0);
  }

  function stashComposerFor(id) {
    const snap = snapshotComposer();
    if (!id) {
      emptyComposerRef.current = snap;
      return;
    }
    setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, composer: snap } : c)));
  }

  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

  useEffect(() => {
    document.body.classList.add("agent-page-open");
    return () => document.body.classList.remove("agent-page-open");
  }, []);

  useEffect(() => {
    if (!modelMenuOpen) return undefined;
    const onPointerDown = (e) => {
      if (modelMenuRef.current && !modelMenuRef.current.contains(e.target)) {
        setModelMenuOpen(false);
      }
    };
    const onKey = (e) => {
      if (e.key === "Escape") setModelMenuOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [modelMenuOpen]);

  useEffect(() => {
    if (!editingId) return undefined;
    const onPointerDown = (e) => {
      if (renameWrapRef.current?.contains(e.target)) return;
      commitRename(editingId);
    };
    const onKey = (e) => {
      if (e.key === "Escape") cancelRename();
    };
    const timer = window.setTimeout(() => {
      document.addEventListener("pointerdown", onPointerDown, true);
      document.addEventListener("keydown", onKey);
    }, 0);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- commit/cancel 稳定闭包当前 editingTitle
  }, [editingId, editingTitle]);

  useEffect(() => {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(conversations));
    } catch {
      // ignore quota errors
    }
  }, [conversations]);

  useEffect(() => {
    try {
      if (activeId) localStorage.setItem(ACTIVE_KEY, activeId);
      else localStorage.removeItem(ACTIVE_KEY);
    } catch {
      // ignore
    }
  }, [activeId]);

  useEffect(() => {
    const conv = conversations.find((c) => c.id === activeId);
    if (conv && Array.isArray(conv.messages)) {
      setMessages(conv.messages);
      resetVisibleMsgCount();
      if (conv.model) {
        setModel(
          conv.model === "deepseek-chat" || conv.model === "deepseek-reasoner"
            ? "deepseek-v4-flash"
            : conv.model
        );
      }
    } else if (!activeId) {
      setMessages([]);
      resetVisibleMsgCount();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally only activeId
  }, [activeId]);

  useEffect(() => {
    const snap = {
      resumeMode,
      question,
      resumeText,
      resumeAttachment:
        resumeAttachment?.status === "ready" && resumeAttachment.token
          ? {
              status: "ready",
              fileName: resumeAttachment.fileName,
              kind: resumeAttachment.kind,
              token: resumeAttachment.token,
            }
          : null,
      resumeSessionId,
      resumeSelectedIndex,
    };
    if (!activeId) {
      emptyComposerRef.current = snap;
      return undefined;
    }
    const timer = setTimeout(() => {
      setConversations((prev) =>
        prev.map((c) => (c.id === activeId ? { ...c, composer: snap } : c))
      );
    }, 300);
    return () => clearTimeout(timer);
  }, [
    activeId,
    resumeMode,
    question,
    resumeText,
    resumeAttachment,
    resumeSessionId,
    resumeSelectedIndex,
  ]);

  function startNewChat() {
    stashComposerFor(activeId);
    emptyComposerRef.current = emptyComposer();
    beginChatSettle();
    userDetachedRef.current = false;
    resetVisibleMsgCount();
    setActiveId(null);
    setMessages([]);
    applyComposer(emptyComposer());
    resumeFlow.abortResumeUpload();
    setError("");
    setRetryQuestion("");
    setSidebarOpen(false);
  }

  function loadConversation(id) {
    if (id === activeId) {
      setSidebarOpen(false);
      return;
    }
    resumeFlow.abortResumeUpload();
    stashComposerFor(activeId);
    const conv = conversations.find((c) => c.id === id);
    if (conv) {
      setModel(
        conv.model === "deepseek-chat" || conv.model === "deepseek-reasoner"
          ? "deepseek-v4-flash"
          : conv.model
      );
      applyComposer(readComposerFromConv(conv));
    } else {
      applyComposer(emptyComposer());
    }
    beginChatSettle();
    userDetachedRef.current = false;
    resetVisibleMsgCount();
    setActiveId(id);
    setError("");
    setRetryQuestion("");
    setSidebarOpen(false);
  }

  function deleteConversation(id, e) {
    e.stopPropagation();
    abortConversation(id);
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (activeId === id) {
      emptyComposerRef.current = emptyComposer();
      setActiveId(null);
      setMessages([]);
      applyComposer(emptyComposer());
    }
    if (editingId === id) {
      setEditingId(null);
      setEditingTitle("");
    }
  }

  function togglePin(id, e) {
    e.stopPropagation();
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, pinned: !c.pinned, timestamp: c.timestamp || Date.now() } : c))
    );
  }

  function startRename(id, e) {
    e.stopPropagation();
    const conv = conversations.find((c) => c.id === id);
    if (!conv) return;
    setEditingId(id);
    setEditingTitle(conv.title || "");
    setTimeout(() => renameInputRef.current?.focus(), 0);
  }

  function commitRename(id) {
    const next = editingTitle.trim();
    setConversations((prev) =>
      prev.map((c) =>
        c.id === id
          ? {
              ...c,
              title: next || c.title || "新对话",
              titleLocked: true,
            }
          : c
      )
    );
    setEditingId(null);
    setEditingTitle("");
  }

  function cancelRename() {
    setEditingId(null);
    setEditingTitle("");
  }

  function toggleDesktopSidebar() {
    setSidebarCollapsed((v) => !v);
  }

  const sidebarProps = {
    sidebarCollapsed,
    setSidebarOpen,
    toggleDesktopSidebar,
    startNewChat,
    sortedConversations,
    activeId,
    editingId,
    editingTitle,
    setEditingTitle,
    renameWrapRef,
    renameInputRef,
    commitRename,
    cancelRename,
    loadConversation,
    generatingIds,
    togglePin,
    startRename,
    deleteConversation,
  };

  return (
    <div
      className={`hw-page hw-page--agent${sidebarOpen ? " hw-page--agent-sidebar-open" : ""}${
        sidebarCollapsed ? " hw-page--agent-sidebar-collapsed" : ""
      }`}
    >
      <aside className={`agent-sidebar${sidebarCollapsed ? " agent-sidebar--collapsed" : ""}`}>
        <AgentSidebar mode="desktop" {...sidebarProps} />
      </aside>

      {sidebarOpen && (
        <>
          <button
            type="button"
            className="agent-sidebar-backdrop"
            aria-label="关闭历史"
            onClick={() => setSidebarOpen(false)}
          />
          <aside className="agent-sidebar agent-sidebar--drawer agent-sidebar--drawer-open">
            <AgentSidebar mode="drawer" {...sidebarProps} />
          </aside>
        </>
      )}

      <main className="agent-main">
        <header className="agent-main__header">
          <div className="agent-main__title-row">
            <button
              type="button"
              className="agent-main__history-btn"
              onClick={() => setSidebarOpen(true)}
              title="历史对话"
            >
              <Icon name="menu" size={16} color="currentColor" />
              历史对话
            </button>
            <h2 className="agent-main__title">{AGENT_PAGE_CONTENT.hero.title}</h2>
          </div>
          {SHOW_MODEL_SETTINGS && (
            <div className="agent-main__settings">
              <div className="agent-main__label">
                模型
                <div
                  className={`agent-model-dd${modelMenuOpen ? " agent-model-dd--open" : ""}`}
                  ref={modelMenuRef}
                >
                  <button
                    type="button"
                    className="agent-model-dd__trigger"
                    aria-haspopup="listbox"
                    aria-expanded={modelMenuOpen}
                    onClick={() => setModelMenuOpen((v) => !v)}
                  >
                    <span className="agent-model-dd__value">{selectedModel.label}</span>
                    <Icon
                      name="chevron-down"
                      size={14}
                      color="var(--text-muted)"
                      className="agent-model-dd__chevron"
                    />
                  </button>
                  {modelMenuOpen && (
                    <ul className="agent-model-dd__menu" role="listbox">
                      {AGENT_PAGE_CONTENT.models.map((m) => (
                        <li key={m.value} role="option" aria-selected={m.value === resolvedModel}>
                          <button
                            type="button"
                            className={`agent-model-dd__option${m.value === resolvedModel ? " agent-model-dd__option--active" : ""}`}
                            onClick={() => {
                              setModel(m.value);
                              setModelMenuOpen(false);
                            }}
                          >
                            {m.label}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              {!isBuiltin && (
                <label className="agent-main__label">
                  API Key
                  <div className="agent-main__key-wrap">
                    <input
                      className="agent-main__input"
                      type={showKey ? "text" : "password"}
                      placeholder="sk-..."
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                    />
                    <button
                      type="button"
                      className="agent-main__toggle"
                      onClick={() => setShowKey((v) => !v)}
                    >
                      {showKey ? "隐藏" : "显示"}
                    </button>
                  </div>
                </label>
              )}

              {resolvedModel === "custom" && (
                <label className="agent-main__label">
                  Base URL
                  <input
                    className="agent-main__input"
                    type="url"
                    placeholder="https://api.example.com/v1"
                    value={customBaseUrl}
                    onChange={(e) => setCustomBaseUrl(e.target.value)}
                  />
                </label>
              )}
            </div>
          )}
        </header>

        <div className={`agent-chat${chatSettling ? " agent-chat--settling" : ""}`} ref={chatRef}>
          <AgentChatMessages
            messages={messages}
            activeId={activeId}
            loading={loading}
            error={error}
            retryQuestion={retryQuestion}
            visibleMessages={visibleMessages}
            hasOlderMessages={hasOlderMessages}
            msgStartIndex={msgStartIndex}
            topSentinelRef={topSentinelRef}
            loadOlderMessages={loadOlderMessages}
            chatEndRef={chatEndRef}
            scrollBtnMounted={scrollBtnMounted}
            scrollBtnLeaving={scrollBtnLeaving}
            setScrollBtnMounted={setScrollBtnMounted}
            setScrollBtnLeaving={setScrollBtnLeaving}
            scrollToBottom={scrollToBottom}
            followStreamHeight={followStreamHeight}
            markdownComponents={markdownComponents}
            copiedIdx={copiedIdx}
            copyMessage={copyMessage}
            handleSuggestQuestion={handleSuggestQuestion}
            handleRetry={handleRetry}
            onSelectResumePlan={selectResumePlan}
            onExportResumePlans={exportResumePlansAt}
          />
        </div>

        <AgentComposer
          resumeMode={resumeMode}
          setResumeMode={setResumeMode}
          resumeText={resumeText}
          setResumeText={setResumeText}
          resumeAttachment={resumeAttachment}
          resumeChipRef={resumeFlow.resumeChipRef}
          resumeChipWidth={resumeFlow.resumeChipWidth}
          fileInputRef={resumeFlow.fileInputRef}
          resumeAccept={resumeFlow.RESUME_ACCEPT}
          handleResumeFile={resumeFlow.handleResumeFile}
          clearResumeAttachment={resumeFlow.clearResumeAttachment}
          handleResumeInterview={resumeFlow.handleResumeInterview}
          question={question}
          setQuestion={setQuestion}
          handleSubmit={handleSubmit}
          loading={loading}
          stopGeneration={stopGeneration}
          isBuiltin={isBuiltin}
          apiKey={apiKey}
        />
      </main>
      {lightbox?.images?.length > 0 && (
        <AgentImageLightbox
          images={lightbox.images}
          index={lightbox.index}
          onClose={closeLightbox}
        />
      )}
    </div>
  );
}
