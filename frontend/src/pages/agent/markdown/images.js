export function classNameIncludes(className, token) {
  if (!className) return false;
  if (Array.isArray(className)) return className.includes(token);
  return String(className).split(/\s+/).includes(token);
}

export function resolveAgentImageSrc(src) {
  const s = String(src || "").trim();
  if (!s) return "";
  if (s.startsWith("/knowledge-assets/")) return s;
  if (s.startsWith("knowledge/assets/")) return `/${s}`;
  if (s.startsWith("./assets/") || s.startsWith("assets/")) {
    return `/knowledge-assets/${s.replace(/^\.?\/*assets\//, "")}`;
  }
  if (/^https?:\/\//i.test(s)) return s;
  return s;
}

/**
 * 从 mdast / hast 节点收集图片。
 * react-markdown v10 传给组件的 node 多为 hast（tagName=img），不是 mdast image。
 */
export function collectImagesFromMdastNode(node) {
  const items = [];
  const seen = new Set();

  const push = (rawSrc, alt) => {
    const src = resolveAgentImageSrc(rawSrc);
    if (!src || seen.has(src)) return;
    seen.add(src);
    items.push({ src, alt: alt || "" });
  };

  const walk = (n) => {
    if (!n || typeof n !== "object") return;
    if (n.type === "image") {
      push(n.url, n.alt || "");
      return;
    }
    const tag = String(n.tagName || "").toLowerCase();
    if (n.type === "element" && tag === "img") {
      const props = n.properties || {};
      push(props.src || props.SRC, props.alt || props.ALT || "");
      return;
    }
    for (const c of n.children || []) walk(c);
  };

  walk(node);
  return items;
}

/** 从已渲染的 React children（AgentMarkdownImage）回收集图组 */
export function collectImagesFromReactChildren(children) {
  const items = [];
  const seen = new Set();

  const visit = (node) => {
    if (node == null || typeof node === "boolean") return;
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    if (typeof node !== "object" || !node.props) return;
    const { src, alt, children: nested } = node.props;
    if (typeof src === "string" && src) {
      const resolved = resolveAgentImageSrc(src);
      if (resolved && !seen.has(resolved)) {
        seen.add(resolved);
        items.push({ src: resolved, alt: alt || "" });
      }
    }
    if (nested != null) visit(nested);
  };

  visit(children);
  return items;
}
