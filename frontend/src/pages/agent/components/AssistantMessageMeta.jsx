import { useState } from "react";
import { Icon } from "../../../icons/index.jsx";
import SourceListPanel from "./SourceListPanel.jsx";

/** 生成完成后淡入：追问推荐 + 复制 + 可折叠参考资料 */
export default function AssistantMessageMeta({
  content,
  sources,
  suggestions,
  msgIndex,
  copiedIdx,
  onCopy,
  onSuggest,
  suggestDisabled,
}) {
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [sourcesMounted, setSourcesMounted] = useState(false);
  const [sourcesLeaving, setSourcesLeaving] = useState(false);
  const sourceItems = (sources || []).filter((s) => s && (s.title || s.sourceUrl));
  const hasSources = sourceItems.length > 0;
  const suggestItems = (suggestions || []).filter((s) => typeof s === "string" && s.trim());
  const hasSuggestions = suggestItems.length > 0;

  function toggleSources() {
    if (!hasSources) return;
    if (sourcesOpen) {
      // 先淡出，动画结束后再卸载
      setSourcesOpen(false);
      setSourcesLeaving(true);
      return;
    }
    setSourcesLeaving(false);
    setSourcesMounted(true);
    setSourcesOpen(true);
  }

  return (
    <div className="agent-message__meta">
      {hasSuggestions && (
        <div className="agent-suggest">
          <div className="agent-suggest__label">你可能还想问</div>
          <div className="agent-suggest__chips">
            {suggestItems.map((q) => (
              <button
                key={q}
                type="button"
                className="agent-suggest__chip"
                disabled={suggestDisabled}
                onClick={() => onSuggest?.(q)}
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="agent-message__toolbar">
        <button
          type="button"
          className="agent-message__tool-btn"
          onClick={() => onCopy(content, msgIndex)}
          title="复制"
        >
          <Icon name="copy" size={14} color="currentColor" />
          {copiedIdx === msgIndex ? "已复制" : "复制"}
        </button>
        {hasSources && (
          <button
            type="button"
            className={`agent-message__tool-btn${sourcesOpen ? " agent-message__tool-btn--on" : ""}`}
            onClick={toggleSources}
            title={sourcesOpen ? "收起参考资料" : "展开参考资料"}
            aria-expanded={sourcesOpen}
          >
            <Icon name="book" size={14} color="currentColor" />
            参考资料
            <span className="agent-message__tool-count">{sourceItems.length}</span>
          </button>
        )}
      </div>
      {hasSources && sourcesMounted && (
        <div
          className={`agent-retrieved${sourcesLeaving ? " agent-retrieved--leave" : " agent-retrieved--enter"}`}
          onAnimationEnd={(e) => {
            if (e.target !== e.currentTarget) return;
            if (!sourcesLeaving) return;
            setSourcesMounted(false);
            setSourcesLeaving(false);
          }}
        >
          <SourceListPanel sources={sourceItems} />
        </div>
      )}
    </div>
  );
}
