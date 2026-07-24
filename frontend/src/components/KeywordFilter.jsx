import { useState } from "react";

export default function KeywordFilter({ keywords, selected, onChange }) {
  const [expanded, setExpanded] = useState(true);

  if (!keywords.length) return null;

  const allSelected = selected.length === keywords.length;

  return (
    <div className="keyword-filter">
      <div className="keyword-filter__header">
        <span className="keyword-filter__title">关键词筛选</span>
        <button
          type="button"
          className="keyword-filter__toggle"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? "收起" : "展开"}
        </button>
      </div>

      {expanded && (
        <>
          <div className="keyword-filter__tags">
            {keywords.map((kw) => {
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
        </>
      )}
    </div>
  );
}
