import { Children } from "react";
import katex from "katex";

function latexFromChildren(children) {
  if (typeof children === "string" || typeof children === "number") {
    return String(children).trim();
  }
  return Children.toArray(children)
    .map((child) =>
      typeof child === "string" || typeof child === "number" ? String(child) : "",
    )
    .join("")
    .trim();
}

/**
 * MDX 内 LaTeX 渲染。
 * 务必使用 latex="..." 字符串属性：子节点写法里 {9}、{15} 会被 JSX 当成表达式，花括号会丢失。
 * @param {{ latex?: string, children?: import('react').ReactNode, display?: boolean }} props
 */
export default function Math({ latex, children, display = false }) {
  const tex = (latex ?? latexFromChildren(children))?.trim();
  if (!tex) return null;

  const html = katex.renderToString(tex, {
    displayMode: display,
    throwOnError: false,
    strict: "ignore",
  });

  if (display) {
    return (
      <div
        className="problem-math problem-math--block"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }

  return (
    <span
      className="problem-math problem-math--inline"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
