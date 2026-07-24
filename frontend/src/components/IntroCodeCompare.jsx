import { useMemo } from "react";
import { highlightCode } from "../utils/highlightCode.js";
import { Icon } from "../icons/index.jsx";

function highlightWithMark(code, lang, mark) {
  const trimmed = code.trim();
  if (!mark || !trimmed.includes(mark)) {
    return highlightCode(trimmed, lang);
  }

  return trimmed
    .split("\n")
    .map((line) => {
      const highlighted = highlightCode(line, lang);
      if (line.includes(mark)) {
        return `<span class="intro-code-window__mark-line">${highlighted}</span>`;
      }
      return highlighted;
    })
    .join("\n");
}

function IntroCodeWindow({ title, code, lang = "python", hint, mark }) {
  const highlighted = useMemo(
    () => highlightWithMark(code, lang, mark),
    [code, lang, mark],
  );

  return (
    <div className="intro-code-window">
      <div className="intro-code-window__header">
        <span className="intro-code-window__dot" />
        <span className="intro-code-window__dot" />
        <span className="intro-code-window__dot" />
        <span className="intro-code-window__title">{title}</span>
      </div>
      <div className="intro-code-window__body">
        <pre className="intro-code-window__pre">
          <code
            className="intro-code-window__code hljs"
            dangerouslySetInnerHTML={{ __html: highlighted }}
          />
        </pre>
        {hint && (
          <div className="intro-code-window__hint">
            <Icon name="alert-triangle" size={16} color="var(--warning)" />
            <span>{hint}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function IntroCodeCompare({ panels }) {
  return (
    <div className="intro-code-compare">
      {panels.map((panel) => (
        <IntroCodeWindow
          key={panel.title}
          title={panel.title}
          code={panel.code}
          lang={panel.lang ?? "python"}
          hint={panel.hint}
          mark={panel.mark}
        />
      ))}
    </div>
  );
}
