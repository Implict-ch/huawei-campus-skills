import remarkGfm from "remark-gfm";

/** 将连续的「仅含图片」段落合并，便于前端一行展示 */
function remarkGroupImages() {
  const isImageOnlyParagraph = (node) => {
    if (!node || node.type !== "paragraph" || !Array.isArray(node.children)) return false;
    let hasImage = false;
    for (const c of node.children) {
      if (c.type === "image") {
        hasImage = true;
        continue;
      }
      if (c.type === "break" || c.type === "softbreak") continue;
      if (c.type === "text" && !String(c.value || "").trim()) continue;
      return false;
    }
    return hasImage;
  };

  const regroup = (parent) => {
    if (!parent?.children?.length) return;
    for (const child of parent.children) {
      if (child?.children) regroup(child);
    }
    const out = [];
    let i = 0;
    const kids = parent.children;
    while (i < kids.length) {
      if (!isImageOnlyParagraph(kids[i])) {
        out.push(kids[i]);
        i += 1;
        continue;
      }
      const images = [];
      while (i < kids.length && isImageOnlyParagraph(kids[i])) {
        for (const c of kids[i].children) {
          if (c.type === "image") images.push(c);
        }
        i += 1;
      }
      if (images.length <= 1) {
        out.push({ type: "paragraph", children: images });
      } else {
        out.push({
          type: "paragraph",
          data: {
            hProperties: {
              className: ["agent-message__img-row"],
              "data-agent-gallery": "true",
            },
          },
          children: images,
        });
      }
    }
    parent.children = out;
  };

  return (tree) => regroup(tree);
}

export const REMARK_PLUGINS = [remarkGfm, remarkGroupImages];

/** 统计 GFM 表格一行的列数 */
function countPipeRowCols(row) {
  const t = String(row || "").trim();
  if (!t.includes("|")) return 0;
  const inner = t.replace(/^\|/, "").replace(/\|$/, "");
  return inner.split("|").length;
}

/** 按列数把挤在同一行的 `| a | b | | c | d |` 拆成多行 */
function splitPipeCellsToRows(line, cols) {
  const t = String(line || "").trim();
  if (!t.startsWith("|") || cols < 2) return [];
  const raw = t.replace(/^\|/, "").replace(/\|$/, "").split("|");
  const rows = [];
  let i = 0;
  while (i < raw.length) {
    // 行与行之间常夹一个空 cell
    if (rows.length > 0 && String(raw[i]).trim() === "" && raw.length - i >= cols) {
      i += 1;
      continue;
    }
    if (i + cols > raw.length) break;
    const slice = raw.slice(i, i + cols).map((c) => String(c).trim());
    rows.push(`| ${slice.join(" | ")} |`);
    i += cols;
  }
  return rows;
}

/**
 * 模型常把整张 Markdown 表挤成一行；remark-gfm 需要换行才能解析。
 * 已是正常多行表格时保持不变。
 */
function normalizeCollapsedGfmTables(md) {
  if (!md || !md.includes("|")) return md;
  // 表头与 |---| 分隔行粘在一起时先拆开
  let s = md.replace(/(\|)[ \t]+(\|(?:[ \t]*:?-+:?[ \t]*\|)+)/g, "$1\n$2");
  s = s.replace(
    /([^\n]*?)(\|[^\n]+)\n(\|(?:[ \t]*:?-+:?[ \t]*\|)+)[ \t]*([^\n]*)/g,
    (full, prefix, header, sep, rest) => {
      if (prefix.includes("|")) return full;
      const cols = countPipeRowCols(header);
      if (cols < 2) return full;
      const body = rest.trim();
      const head = header.trim();
      const delim = sep.trim();
      let rows = [];
      if (body.startsWith("|")) {
        rows = splitPipeCellsToRows(body, cols);
        if (rows.length === 0) return full;
      } else if (body) {
        return full;
      }
      const table = [head, delim, ...rows].join("\n");
      if (!prefix) return table;
      return `${prefix.trimEnd()}\n${table}`;
    }
  );
  return s;
}

const KB_ASSET_PATH_RE =
  /\/knowledge-assets\/[^\s)\]`'\"<>，。；！？、,]+?\.(?:png|jpe?g|webp|gif)(?:\?[^\s)\]`'\"<>]*)?/gi;

/** 把模型误写成纯文本的配图路径提升为 Markdown 图片，避免气泡里只显示路径 */
function promoteBareKnowledgeAssetPaths(md) {
  if (!md || !md.includes("/knowledge-assets/")) return md;
  let s = String(md);
  // 去掉「路径为 /...」「路径：`/...`」等前缀废话
  s = s.replace(
    /(?:路径为|路径是|路径[:：]|图片路径[:：]|见图[:：]?|配图[:：]?)\s*[`'"]?(\/knowledge-assets\/[^\s)\]`'\"<>，。；！？、,]+?\.(?:png|jpe?g|webp|gif)(?:\?[^\s)\]`'\"<>]*)?)[`'"]?/gi,
    "![]($1)"
  );
  // 独立成行的路径 / 反引号路径
  s = s.replace(
    /^[ \t]*[`'"]?(\/knowledge-assets\/[^\s)\]`'\"<>]+?\.(?:png|jpe?g|webp|gif)(?:\?[^\s)\]`'\"<>]*)?)[`'"]?[ \t]*$/gim,
    "![]($1)"
  );
  // 行内反引号包裹的配图路径（且尚未在 ![]( ) 内）
  s = s.replace(/`(\/knowledge-assets\/[^`]+?\.(?:png|jpe?g|webp|gif)(?:\?[^`]*)?)`/gi, (full, path, offset) => {
    const before = s.slice(Math.max(0, offset - 3), offset);
    if (before.endsWith("](") || /!\[/.test(before)) return full;
    return `![](${path})`;
  });
  // 兜底：仍裸露的 /knowledge-assets/... 图片路径
  s = s.replace(KB_ASSET_PATH_RE, (path, offset) => {
    const before = s.slice(Math.max(0, offset - 4), offset);
    if (before.endsWith("](") || before.endsWith("![")) return path;
    if (before.endsWith("`") || before.endsWith('"') || before.endsWith("'")) return path;
    return `![](${path})`;
  });
  return s;
}

export function prepareAgentMarkdown(md) {
  return promoteBareKnowledgeAssetPaths(normalizeCollapsedGfmTables(md));
}
