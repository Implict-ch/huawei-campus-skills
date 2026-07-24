import { useState, useEffect, useCallback } from "react";

/** 从正文 H2/H3 的 data-toc-id 自动提取目录 */
export function useTocFromHeadings(containerRef, resetKey) {
  const [items, setItems] = useState([]);

  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;

    const headings = root.querySelectorAll("[data-toc-id]");
    const next = Array.from(headings).map((el) => ({
      id: el.dataset.tocId,
      label: el.textContent.trim(),
      level: el.tagName === "H3" ? 3 : 2,
    }));
    setItems(next);
  }, [containerRef, resetKey]);

  return items;
}

export default function PageTOC({ items, activeId, onSelect }) {
  return (
    <aside className="problem-page-toc">
      <div className="problem-page-toc__title">目录</div>
      <nav className="problem-page-toc__nav">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`problem-page-toc__item problem-page-toc__item--level-${item.level}${
              activeId === item.id ? " problem-page-toc__item--active" : ""
            }`}
            onClick={() => onSelect(item.id)}
          >
            {activeId === item.id && (
              <span className="problem-page-toc__dot" aria-hidden="true">
                ●
              </span>
            )}
            {item.label}
          </button>
        ))}
      </nav>
    </aside>
  );
}

export function usePageTOC(items) {
  const [activeId, setActiveId] = useState(items[0]?.id ?? "");

  const handleSelect = useCallback((id) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    setActiveId(id);
  }, []);

  useEffect(() => {
    const headings = document.querySelectorAll("[data-toc-id]");
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveId(entry.target.dataset.tocId);
          }
        });
      },
      { rootMargin: "-100px 0px -70% 0px", threshold: 0 },
    );
    headings.forEach((h) => observer.observe(h));
    return () => observer.disconnect();
  }, [items]);

  return { activeId, handleSelect };
}
