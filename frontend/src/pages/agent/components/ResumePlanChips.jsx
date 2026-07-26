import { useState } from "react";
import { Icon } from "../../../icons/index.jsx";

/** 模拟面试分组 chip：第 x 组 + 导出 */
export default function ResumePlanChips({
  plans,
  selectedIndex = 0,
  onSelect,
  onExport,
  disabled = false,
}) {
  const list = Array.isArray(plans) ? plans : [];
  const [exporting, setExporting] = useState(false);
  if (!list.length) return null;

  return (
    <div className="agent-plan-chips" role="tablist" aria-label="面试题分组">
      {list.map((p, i) => {
        const active = i === selectedIndex;
        const label = p.label || `第${i + 1}组`;
        return (
          <button
            key={`plan-${i}`}
            type="button"
            role="tab"
            aria-selected={active}
            className={`agent-plan-chip${active ? " agent-plan-chip--active" : ""}`}
            disabled={disabled || exporting}
            title={p.angle ? `${label} · ${p.angle}` : label}
            onClick={() => onSelect?.(i)}
          >
            {label}
          </button>
        );
      })}
      <button
        type="button"
        className="agent-plan-chip agent-plan-chip--export"
        disabled={disabled || exporting}
        title="导出全部组为 Markdown 并打包 zip"
        onClick={async () => {
          if (!onExport || exporting) return;
          setExporting(true);
          try {
            await onExport();
          } finally {
            setExporting(false);
          }
        }}
      >
        <Icon name="download" size={13} color="currentColor" />
        {exporting ? "导出中…" : "导出"}
      </button>
    </div>
  );
}
