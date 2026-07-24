import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "../icons/index.jsx";

const VIEWPORT_PAD = 40;

/**
 * 交互步进画板外壳：右上角全屏按钮 + 背景虚化放大
 * @param {{
 *   className: string;
 *   ariaLabel: string;
 *   fitKey?: string | number;
 *   children: import('react').ReactNode;
 * }} props
 */
export default function WalkthroughPanel({ className, ariaLabel, fitKey, children }) {
  const [expanded, setExpanded] = useState(false);
  const panelRef = useRef(null);
  const [scale, setScale] = useState(1);

  const fitPanel = useCallback(() => {
    const el = panelRef.current;
    if (!el) return;
    el.style.transform = "none";
    const w = Math.max(el.offsetWidth, el.scrollWidth);
    const h = Math.max(el.offsetHeight, el.scrollHeight);
    if (w <= 0 || h <= 0) return;
    const sx = (window.innerWidth - VIEWPORT_PAD * 2) / w;
    const sy = (window.innerHeight - VIEWPORT_PAD * 2) / h;
    setScale(Math.min(sx, sy));
  }, []);

  useLayoutEffect(() => {
    if (!expanded) {
      setScale(1);
      return;
    }
    fitPanel();
    const raf = requestAnimationFrame(() => {
      fitPanel();
      requestAnimationFrame(fitPanel);
    });
    const el = panelRef.current;
    if (!el) return () => cancelAnimationFrame(raf);
    const ro = new ResizeObserver(fitPanel);
    ro.observe(el);
    window.addEventListener("resize", fitPanel);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("resize", fitPanel);
    };
  }, [expanded, fitPanel, fitKey]);

  useEffect(() => {
    if (!expanded) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => {
      if (e.key === "Escape") setExpanded(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [expanded]);

  const panel = (
    <section
      ref={panelRef}
      className={`walkthrough-panel ${className}${expanded ? " walkthrough-panel--expanded" : ""}`.trim()}
      aria-label={ariaLabel}
      style={
        expanded
          ? { transform: `scale(${scale})`, transformOrigin: "center center" }
          : undefined
      }
    >
      <button
        type="button"
        className="walkthrough-panel__fs-btn"
        onClick={() => setExpanded((v) => !v)}
        aria-label={expanded ? "退出全屏" : "全屏查看"}
        aria-pressed={expanded}
      >
        <Icon name={expanded ? "minimize" : "maximize"} size={18} />
      </button>
      {children}
    </section>
  );

  if (expanded) {
    return createPortal(
      <div
        className="walkthrough-fs-backdrop"
        role="presentation"
        onClick={(e) => {
          if (e.target === e.currentTarget) setExpanded(false);
        }}
      >
        <div className="walkthrough-fs-backdrop__stage">{panel}</div>
      </div>,
      document.body,
    );
  }

  return panel;
}
