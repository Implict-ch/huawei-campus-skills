import { useMemo, useState } from "react";
import { Icon } from "../icons/index.jsx";
import { highlightCode } from "../utils/highlightCode.js";

function splitLines(code) {
  return code.split("\n");
}

/**
 * 高亮代码块（无 Tab），与 CodeTabs 共用字体与语法色。
 * @param {Object} props
 * @param {string} props.code — 源码文本，支持 \n 换行
 * @param {string} [props.lang="cpp"] — cpp | python | java | go | javascript
 * @param {"default" | "compact" | "bare"} [props.variant="default"]
 * @param {boolean} [props.copy=false] — 显示复制按钮
 * @param {boolean} [props.lineNumbers=false] — 显示行号（GitHub / VS Code 风格）
 * @param {number[]} [props.highlightLines] — 需要高亮的行号（1-based）
 * @param {string} [props.className] — 附加 class
 */
export default function CodeBlock({
  code,
  lang = "cpp",
  variant = "default",
  copy = false,
  lineNumbers = false,
  highlightLines = [],
  className = "",
}) {
  const [copied, setCopied] = useState(false);

  const { highlighted, lineRows } = useMemo(() => {
    if (!lineNumbers) {
      return { highlighted: highlightCode(code, lang), lineRows: null };
    }

    const lines = splitLines(code);
    const lineRows = lines.map((line, index) => ({
      num: index + 1,
      html: line === "" ? "\u00a0" : highlightCode(line, lang),
    }));

    return { highlighted: null, lineRows };
  }, [code, lang, lineNumbers]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  };

  const rootClass = [
    "code-block",
    variant !== "default" ? `code-block--${variant}` : "",
    lineNumbers ? "code-block--line-numbers" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={rootClass}>
      {copy && (
        <button
          type="button"
          className="code-block__copy"
          onClick={handleCopy}
          aria-label="复制代码"
        >
          {copied ? (
            <Icon name="check" size={14} color="var(--success)" />
          ) : (
            <Icon name="copy" size={14} color="var(--text-muted)" />
          )}
        </button>
      )}

      {lineNumbers ? (
        <div className="code-block__pre code-block__pre--numbered">
          <table className="code-block__table">
            <tbody>
              {lineRows.map((row) => (
                <tr
                  key={row.num}
                  className={`code-block__row${
                    highlightLines.includes(row.num) ? " code-block__row--highlight" : ""
                  }`}
                >
                  <td className="code-block__ln" aria-hidden="true">
                    {row.num}
                  </td>
                  <td className="code-block__line">
                    <code
                      className="code-block__code hljs"
                      dangerouslySetInnerHTML={{ __html: row.html }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <pre className="code-block__pre">
          <code
            className="code-block__code hljs"
            dangerouslySetInnerHTML={{ __html: highlighted }}
          />
        </pre>
      )}
    </div>
  );
}
