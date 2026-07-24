import { useState, useMemo } from "react";
import { groupKeywordEntries } from "../data/keywordGroups.js";

export default function KeywordFilter({ keywords, selected, onChange, role, resultCount }) {
  const [expanded, setExpanded] = useState(true);

  const groups = useMemo(() => groupKeywordEntries(keywords, role), [keywords, role]);

  if (!keywords.length) return null;

  const allSelected = selected.length === keywords.length;

  return (
    <div className={`keyword-filter${expanded ? " keyword-filter--open" : ""}`}>
      <div className="keyword-filter__header">
        <div className="keyword-filter__heading">
          <span className="keyword-filter__title">关键词筛选</span>
          {resultCount != null ? (
            <span className="keyword-filter__count">{resultCount}</span>
          ) : null}
        </div>
        <button
          type="button"
          className="keyword-filter__toggle"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
        >
          {expanded ? "收起" : "展开"}
        </button>
      </div>

      <div className="keyword-filter__collapse" aria-hidden={!expanded}>
        <div className="keyword-filter__collapse-inner">
          <div className="keyword-filter__groups">
            {groups.map((g, idx) => (
              <div key={g.group} className="keyword-filter__group">
                {idx > 0 && <div className="keyword-filter__divider" />}
                <div className="keyword-filter__group-label">{g.label}</div>
                <div className="keyword-filter__tags">
                  {g.items.map((kw) => {
                    const active = selected.includes(kw.keyword);
                    return (
                      <button
                        key={kw.keyword}
                        type="button"
                        className={`keyword-filter__tag ${active ? "keyword-filter__tag--active" : ""}`}
                        onClick={() => {
                          if (active) {
                            onChange(selected.filter((k) => k !== kw.keyword));
                          } else {
                            onChange([...selected, kw.keyword]);
                          }
                        }}
                      >
                        {kw.keyword}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <div className="keyword-filter__footer">
            <button
              type="button"
              className="keyword-filter__action"
              onClick={() => onChange(keywords.map((k) => k.keyword))}
              disabled={allSelected}
            >
              全选
            </button>
            <button
              type="button"
              className="keyword-filter__action"
              onClick={() => onChange([])}
              disabled={selected.length === 0}
            >
              全不选
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
