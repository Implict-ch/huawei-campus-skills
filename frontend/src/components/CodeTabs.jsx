import { useState, useEffect } from "react";
import CodeBlock from "./CodeBlock.jsx";

const LANG_KEY = "preferredLanguage";

function readPreferredLanguage(codes) {
  const langs = Object.keys(codes);
  try {
    const saved = localStorage.getItem(LANG_KEY);
    return saved && codes[saved] ? saved : langs[0];
  } catch {
    return langs[0];
  }
}

const LANG_LABELS = {
  cpp: "C++",
  python: "Python",
  java: "Java",
  go: "Go",
  javascript: "JavaScript",
};

/**
 * @param {{
 *   codes: Record<string, string>,
 *   highlights?: Record<string, number[]>,
 *   variants?: Record<string, { label: string, code: string }[]>,
 * }} props
 */
export default function CodeTabs({ codes, highlights = {}, variants = {} }) {
  const langs = Object.keys(codes);
  const [active, setActive] = useState(() => readPreferredLanguage(codes));

  const langVariants = variants[active];
  const [variantIndex, setVariantIndex] = useState(0);

  useEffect(() => {
    try {
      localStorage.setItem(LANG_KEY, active);
    } catch {
      /* 隐私模式等场景下忽略 */
    }
  }, [active]);

  useEffect(() => {
    setVariantIndex(0);
  }, [active]);

  const activeCode =
    langVariants?.[variantIndex]?.code ?? codes[active] ?? "";

  return (
    <div className="code-tabs">
      <div className="code-tabs__bar" role="tablist" aria-label="编程语言">
        {langs.map((lang) => (
          <button
            key={lang}
            type="button"
            role="tab"
            aria-selected={active === lang}
            className={`code-tabs__tab${active === lang ? " code-tabs__tab--active" : ""}`}
            onClick={() => setActive(lang)}
          >
            {LANG_LABELS[lang] ?? lang}
          </button>
        ))}
      </div>
      {langVariants && langVariants.length > 1 ? (
        <div className="code-tabs__sub-bar" role="tablist" aria-label="同语言写法切换">
          {langVariants.map((item, index) => (
            <button
              key={item.label}
              type="button"
              role="tab"
              aria-selected={variantIndex === index}
              className={`code-tabs__sub-tab${
                variantIndex === index ? " code-tabs__sub-tab--active" : ""
              }`}
              onClick={() => setVariantIndex(index)}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
      <CodeBlock
        code={activeCode}
        lang={active}
        variant="bare"
        copy
        lineNumbers
        highlightLines={highlights[active] ?? []}
        className="code-tabs__panel"
      />
    </div>
  );
}
