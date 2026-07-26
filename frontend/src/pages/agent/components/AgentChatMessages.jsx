import ReactMarkdown from "react-markdown";
import { Icon } from "../../../icons/index.jsx";
import { REMARK_PLUGINS, prepareAgentMarkdown } from "../markdown/preprocess.js";
import SmoothGrowBox from "../markdown/SmoothGrowBox.jsx";
import AssistantMessageMeta from "./AssistantMessageMeta.jsx";
import ResumePlanChips from "./ResumePlanChips.jsx";

export default function AgentChatMessages({
  messages,
  activeId,
  loading,
  error,
  retryQuestion,
  visibleMessages,
  hasOlderMessages,
  msgStartIndex,
  topSentinelRef,
  loadOlderMessages,
  chatEndRef,
  scrollBtnMounted,
  scrollBtnLeaving,
  setScrollBtnMounted,
  setScrollBtnLeaving,
  scrollToBottom,
  followStreamHeight,
  markdownComponents,
  copiedIdx,
  copyMessage,
  handleSuggestQuestion,
  handleRetry,
  onSelectResumePlan,
  onExportResumePlans,
}) {
  return (
    <>
      {messages.length === 0 && !error && (
        <div className="agent-chat__empty">
          <Icon name="robot" size={48} color="var(--accent)" />
          <p>有什么问题，我帮你查知识库。</p>
          <p className="agent-chat__hint">也可以点击下方「简历模拟面试」，粘贴简历生成面试题。</p>
        </div>
      )}

      {hasOlderMessages && (
        <div ref={topSentinelRef} className="agent-chat__lazy-top" aria-hidden="true">
          <button type="button" className="agent-chat__lazy-more" onClick={loadOlderMessages}>
            加载更早消息
          </button>
        </div>
      )}

      {visibleMessages.map((m, offset) => {
        const i = msgStartIndex + offset;
        const isLiveAssistant =
          loading && m.role === "assistant" && i === messages.length - 1;
        const isStreamingAssistant = isLiveAssistant && !m.content;
        const resumePlans = Array.isArray(m.resumePlans) ? m.resumePlans : [];
        const planIndex =
          typeof m.resumePlanIndex === "number" ? m.resumePlanIndex : 0;
        return (
          <div
            key={`${activeId || "new"}-${i}`}
            data-msg-index={i}
            className={`agent-message ${m.role === "user" ? "agent-message--user" : "agent-message--assistant"}`}
          >
            <div className="agent-message__avatar">
              {m.role === "user" ? "我" : <Icon name="robot" size={16} color="currentColor" />}
            </div>
            <div className="agent-message__stack">
              {m.role === "assistant" && resumePlans.length > 0 && !isStreamingAssistant && (
                <ResumePlanChips
                  plans={resumePlans}
                  selectedIndex={planIndex}
                  disabled={isLiveAssistant}
                  onSelect={(idx) => onSelectResumePlan?.(i, idx)}
                  onExport={() => onExportResumePlans?.(i)}
                />
              )}
              {m.role === "assistant" ? (
                m.content ? (
                  <SmoothGrowBox
                    active={isLiveAssistant}
                    onGrow={followStreamHeight}
                    className={`agent-message__body${isLiveAssistant ? " agent-message__body--streaming" : ""}`}
                  >
                    <ReactMarkdown
                      remarkPlugins={REMARK_PLUGINS}
                      components={markdownComponents}
                    >
                      {prepareAgentMarkdown(m.content)}
                    </ReactMarkdown>
                  </SmoothGrowBox>
                ) : (
                  <div
                    className={`agent-message__body${isStreamingAssistant ? " agent-message__body--loading" : ""}`}
                  >
                    {isStreamingAssistant ? (
                      <>
                        <span className="agent-message__dot" />
                        <span className="agent-message__dot" />
                        <span className="agent-message__dot" />
                      </>
                    ) : null}
                  </div>
                )
              ) : (
                <div className="agent-message__body">
                  <p className="agent-message__user-text">{m.content}</p>
                </div>
              )}
              {m.role === "assistant" && m.content && !isLiveAssistant && (
                <AssistantMessageMeta
                  content={m.content}
                  sources={m.sources}
                  suggestions={m.suggestions}
                  msgIndex={i}
                  copiedIdx={copiedIdx}
                  onCopy={copyMessage}
                  onSuggest={handleSuggestQuestion}
                  suggestDisabled={loading}
                />
              )}
            </div>
          </div>
        );
      })}

      {loading && messages[messages.length - 1]?.role !== "assistant" && (
        <div className="agent-message agent-message--assistant">
          <div className="agent-message__avatar">
            <Icon name="robot" size={16} color="currentColor" />
          </div>
          <div className="agent-message__body agent-message__body--loading">
            <span className="agent-message__dot" />
            <span className="agent-message__dot" />
            <span className="agent-message__dot" />
          </div>
        </div>
      )}

      {error && (
        <div className="agent-message agent-message--error">
          <div className="agent-message__avatar agent-message__avatar--error">
            <Icon name="alert-triangle" size={16} color="currentColor" />
          </div>
          <div className="agent-message__stack">
            <div className="agent-message__body">{error}</div>
            {retryQuestion && !loading && (
              <div className="agent-message__toolbar">
                <button type="button" className="agent-message__tool-btn" onClick={handleRetry}>
                  重试
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <div ref={chatEndRef} className="agent-chat__end-anchor" aria-hidden="true" />

      {scrollBtnMounted && (
        <button
          type="button"
          className={`agent-chat__scroll-bottom${scrollBtnLeaving ? " agent-chat__scroll-bottom--leave" : " agent-chat__scroll-bottom--enter"}`}
          onClick={scrollToBottom}
          disabled={scrollBtnLeaving}
          title="回到底部"
          aria-hidden={scrollBtnLeaving}
          onAnimationEnd={(e) => {
            if (e.target !== e.currentTarget) return;
            if (!scrollBtnLeaving) return;
            setScrollBtnMounted(false);
            setScrollBtnLeaving(false);
          }}
        >
          <Icon name="arrow-down" size={16} color="currentColor" />
        </button>
      )}
    </>
  );
}
