export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function isAbortError(err) {
  return (
    err?.name === "AbortError" ||
    /abort|The user aborted a request/i.test(String(err?.message || ""))
  );
}

/**
 * 带行缓冲的 SSE 解析，避免跨 chunk 半行 JSON 丢失。
 * onEvent(parsed) 可返回 false 终止读取。
 */
export async function readSSEStream(res, { signal, onEvent } = {}) {
  if (!res.body) throw new Error("浏览器不支持流式响应");
  const reader = res.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  let answer = "";
  let retrieved = [];
  let suggestions = [];
  let meta = null;

  const handleLine = (line) => {
    const trimmed = line.trim();
    if (!trimmed) return true;
    const dataLine = trimmed.startsWith("data: ") ? trimmed.slice(6) : trimmed;
    if (dataLine === "[DONE]") return false;
    let parsed;
    try {
      parsed = JSON.parse(dataLine);
    } catch {
      return true;
    }
    if (parsed.error) throw new Error(parsed.error);
    if (parsed.meta) meta = parsed.meta;
    if (parsed.replace && parsed.answer) {
      answer = parsed.answer;
    } else if (typeof parsed.chunk === "string") {
      answer += parsed.chunk;
    }
    if (Array.isArray(parsed.retrieved)) {
      retrieved = parsed.retrieved;
    }
    if (Array.isArray(parsed.suggestions)) {
      suggestions = parsed.suggestions.filter((s) => typeof s === "string" && s.trim());
    }
    if (onEvent) {
      const cont = onEvent({ parsed, answer, retrieved, suggestions, meta });
      if (cont === false) return false;
    }
    return true;
  };

  try {
    while (true) {
      if (signal?.aborted) {
        try {
          await reader.cancel();
        } catch {
          // ignore
        }
        break;
      }
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split("\n");
      buffer = parts.pop() ?? "";
      for (const line of parts) {
        if (handleLine(line) === false) {
          try {
            await reader.cancel();
          } catch {
            // ignore
          }
          return { answer, retrieved, suggestions, meta, aborted: !!signal?.aborted };
        }
      }
    }
    if (buffer.trim()) handleLine(buffer);
  } catch (err) {
    if (isAbortError(err) || signal?.aborted) {
      return { answer, retrieved, suggestions, meta, aborted: true };
    }
    throw err;
  }

  return { answer, retrieved, suggestions, meta, aborted: !!signal?.aborted };
}

export function formatTitle(question) {
  let t = String(question || "")
    .replace(/^【简历模拟面试】\s*/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!t) return "新对话";
  return t.length > 28 ? t.slice(0, 28) + "…" : t;
}

/** 从简历正文提取更可读的历史标题 */
export function formatResumeTitle(resumeText, fileName) {
  if (fileName) {
    const base = fileName.replace(/\.(pdf|txt|md)$/i, "");
    return formatTitle(`简历面试 · ${base}`);
  }
  const text = String(resumeText || "")
    .replace(/^【简历模拟面试】\s*/m, "")
    .trim();
  const nameMatch = text.match(/(?:姓名|名字)\s*[:：]?\s*([^\n，,|】*]{2,12})/);
  const roleMatch = text.match(/(?:求职意向|目标岗位|应聘岗位|意向岗位|岗位意向)\s*[:：]?\s*([^\n]{2,24})/);
  const name = nameMatch?.[1]?.replace(/[*#`]/g, "").trim();
  const role = roleMatch?.[1]?.replace(/[*#`]/g, "").trim();
  if (name && role) return formatTitle(`${name} · ${role}`);
  if (role) return formatTitle(`简历面试 · ${role}`);
  if (name) return formatTitle(`简历面试 · ${name}`);
  const line = text
    .split(/\n/)
    .map((l) => l.trim().replace(/^#+\s*/, "").replace(/[*`]/g, ""))
    .find((l) => l && !l.startsWith("-") && !l.startsWith("【") && l.length >= 2 && l.length <= 40);
  if (line) return formatTitle(`简历面试 · ${line}`);
  return "简历模拟面试";
}

export function isInternalPath(href) {
  if (!href) return false;
  if (href.startsWith("/") && !href.startsWith("//")) return true;
  try {
    const url = new URL(href, window.location.origin);
    return url.origin === window.location.origin;
  } catch {
    return false;
  }
}

export function toInternalPath(href) {
  if (href.startsWith("/") && !href.startsWith("//")) return href;
  try {
    const url = new URL(href, window.location.origin);
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return href;
  }
}

/** 站内链接带上 from=agent，详情页可据此显示「返回智能问答」 */
export function withAgentReferrer(href) {
  try {
    const url = new URL(toInternalPath(href), window.location.origin);
    url.searchParams.set("from", "agent");
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    const base = toInternalPath(href);
    return base.includes("?") ? `${base}&from=agent` : `${base}?from=agent`;
  }
}

export function detectResumeKind(file) {
  const name = String(file?.name || "").toLowerCase();
  if (name.endsWith(".doc") && !name.endsWith(".docx")) {
    throw new Error("暂不支持旧版 Word（.doc），请另存为 .docx 或 PDF");
  }
  if (name.endsWith(".pdf")) return "pdf";
  if (name.endsWith(".md") || name.endsWith(".markdown")) return "md";
  if (name.endsWith(".docx")) return "docx";
  throw new Error("仅支持 PDF、Markdown（.md）或 Word（.docx）");
}

export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      const base64 = result.includes(",") ? result.split(",")[1] : result;
      resolve(base64);
    };
    reader.onerror = () => reject(new Error("读取文件失败"));
    reader.readAsDataURL(file);
  });
}

export function resumeKindIcon(kind) {
  if (kind === "pdf") return "file-pdf";
  if (kind === "docx") return "file-word";
  return "file-text";
}
