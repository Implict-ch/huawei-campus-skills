/**
 * 简历上传安全校验 + 文本抽取
 * - 仅允许 pdf / md / docx（旧版 .doc 明确拒绝，避免 OLE 宏风险）
 * - 魔数校验、大小限制、docx zip 炸弹防护、频控
 * - 纯图片 PDF：截图后尝试 DeepSeek 识图 OCR（API 若尚不支持会明确报错）
 * - 安全抽字后由大模型判别是否为简历
 * - 抽取文本后发 token，提交面试时用 token 取正文（避免重复传大文件）
 */
import crypto from "node:crypto";
import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";
import OpenAI from "openai";

export const RESUME_MAX_BYTES = 5 * 1024 * 1024; // 5MB 原始文件
export const RESUME_MAX_TEXT_CHARS = 80_000;
const UPLOAD_TTL_MS = 30 * 60 * 1000;
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX = 12; // 每 IP 每窗口最多上传次数
const MIN_TEXT_CHARS = 40;
/** 文本层过短时触发截图 OCR */
const OCR_TRIGGER_CHARS = 80;
const MAX_OCR_PAGES = 4;

/** @type {Map<string, { text: string, fileName: string, kind: string, createdAt: number, ip: string }>} */
const uploadStore = new Map();
/** @type {Map<string, number[]>} */
const rateHits = new Map();

const ALLOWED = {
  pdf: {
    exts: [".pdf"],
    mimes: ["application/pdf"],
  },
  md: {
    exts: [".md", ".markdown"],
    mimes: ["text/markdown", "text/plain", "text/x-markdown"],
  },
  docx: {
    exts: [".docx"],
    mimes: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  },
};

const NOT_RESUME_MSG = "文件不是简历，请上传正常的简历";
const OCR_UNSUPPORTED_MSG =
  "未能识别扫描件/图片型 PDF 中的文字。当前 DeepSeek API 暂不支持识图，请上传可选中文字的 PDF，或直接粘贴简历文本。";

function cleanupUploads() {
  const now = Date.now();
  for (const [id, row] of uploadStore.entries()) {
    if (now - row.createdAt > UPLOAD_TTL_MS) uploadStore.delete(id);
  }
}

function clientIp(req) {
  const xf = String(req.headers["x-forwarded-for"] || "")
    .split(",")[0]
    .trim();
  return xf || req.socket?.remoteAddress || "unknown";
}

function checkRateLimit(ip) {
  const now = Date.now();
  const prev = (rateHits.get(ip) || []).filter((t) => now - t < RATE_WINDOW_MS);
  if (prev.length >= RATE_MAX) {
    const err = new Error("上传过于频繁，请稍后再试");
    err.status = 429;
    throw err;
  }
  prev.push(now);
  rateHits.set(ip, prev);
}

function sanitizeFileName(name) {
  const base = String(name || "resume")
    .replace(/[/\\?%*:|"<>]/g, "_")
    .replace(/\0/g, "")
    .trim();
  const clipped = base.slice(0, 120) || "resume";
  return clipped;
}

function extOf(fileName) {
  const m = String(fileName || "")
    .toLowerCase()
    .match(/(\.[a-z0-9]+)$/);
  return m ? m[1] : "";
}

function detectKind(fileName, mime) {
  const ext = extOf(fileName);
  const m = String(mime || "").toLowerCase();
  if (ext === ".doc") {
    const err = new Error("暂不支持旧版 Word（.doc）。请另存为 .docx 或 PDF 后上传");
    err.status = 400;
    throw err;
  }
  // 扩展名优先，避免 application/octet-stream 误判
  for (const [kind, rule] of Object.entries(ALLOWED)) {
    if (rule.exts.includes(ext)) return kind;
  }
  if (ext) {
    const err = new Error("仅支持 PDF、Markdown（.md）或 Word（.docx）简历");
    err.status = 400;
    throw err;
  }
  for (const [kind, rule] of Object.entries(ALLOWED)) {
    if (m && rule.mimes.includes(m)) return kind;
  }
  const err = new Error("仅支持 PDF、Markdown（.md）或 Word（.docx）简历");
  err.status = 400;
  throw err;
}

function assertMagic(kind, buffer) {
  if (!buffer?.length) {
    const err = new Error("文件内容为空");
    err.status = 400;
    throw err;
  }
  if (kind === "pdf") {
    const head = buffer.subarray(0, 5).toString("utf8");
    if (head !== "%PDF-") {
      const err = new Error("文件不是有效的 PDF（魔数校验失败）");
      err.status = 400;
      throw err;
    }
  }
  if (kind === "docx") {
    // ZIP local file header
    if (buffer[0] !== 0x50 || buffer[1] !== 0x4b) {
      const err = new Error("文件不是有效的 Word（.docx）");
      err.status = 400;
      throw err;
    }
  }
  if (kind === "md") {
    // 拒绝明显二进制 / 可执行伪装
    const sample = buffer.subarray(0, Math.min(buffer.length, 4096));
    let nul = 0;
    for (let i = 0; i < sample.length; i++) if (sample[i] === 0) nul += 1;
    if (nul > 0) {
      const err = new Error("Markdown 文件包含非法二进制内容");
      err.status = 400;
      throw err;
    }
  }
}

/** 粗粒度 zip 炸弹检测：统计 uncompressed size 声明 */
function assertDocxZipSafe(buffer) {
  let offset = 0;
  let entries = 0;
  let uncompressedTotal = 0;
  const MAX_ENTRIES = 2000;
  const MAX_UNCOMPRESSED = 40 * 1024 * 1024; // 40MB

  while (offset + 30 <= buffer.length) {
    if (buffer[offset] !== 0x50 || buffer[offset + 1] !== 0x4b) break;
    const sig = buffer.readUInt32LE(offset);
    // local file header 0x04034b50
    if (sig === 0x04034b50) {
      const compMethod = buffer.readUInt16LE(offset + 8);
      const uncomp = buffer.readUInt32LE(offset + 22);
      const nameLen = buffer.readUInt16LE(offset + 26);
      const extraLen = buffer.readUInt16LE(offset + 28);
      const compSize = buffer.readUInt32LE(offset + 18);
      entries += 1;
      uncompressedTotal += uncomp;
      if (entries > MAX_ENTRIES || uncompressedTotal > MAX_UNCOMPRESSED) {
        const err = new Error("Word 文件结构异常（疑似压缩炸弹），已拒绝");
        err.status = 400;
        throw err;
      }
      // store / deflate：跳过数据区
      offset += 30 + nameLen + extraLen + (compMethod === 0 ? uncomp : compSize);
      continue;
    }
    // central directory / end — 停止
    break;
  }
}

function normalizeChatModel(name) {
  const m = String(name || "").trim();
  if (!m || m === "deepseek-chat" || m === "deepseek-reasoner") return "deepseek-v4-flash";
  return m;
}

function getBuiltinLlm() {
  const apiKey = process.env.BUILTIN_API_KEY || "";
  const baseUrl = process.env.BUILTIN_BASE_URL || "https://api.deepseek.com/v1";
  const model = normalizeChatModel(process.env.BUILTIN_MODEL || "deepseek-v4-flash");
  if (!apiKey) return null;
  return {
    apiKey,
    baseUrl,
    model,
    client: new OpenAI({
      apiKey,
      baseURL: baseUrl,
      timeout: 90000,
      maxRetries: 1,
    }),
  };
}

function isVisionUnsupportedError(err) {
  const msg = String(err?.message || err || "");
  return /unknown variant `image_url`|unknown variant `input_image`|expected `text`|does not support|not support.*image|invalid.*image/i.test(
    msg
  );
}

/**
 * 尝试用 DeepSeek 多模态识图（OpenAI 格式；失败则明确报不支持）
 */
async function ocrPagesWithDeepSeek(pages) {
  const llm = getBuiltinLlm();
  if (!llm) {
    const err = new Error(OCR_UNSUPPORTED_MSG);
    err.status = 400;
    throw err;
  }

  const content = [
    {
      type: "text",
      text: "请完整提取下列简历页面图片中的全部文字，按阅读顺序输出纯文本，不要总结、不要遗漏。",
    },
    ...pages.map((p) => ({
      type: "image_url",
      image_url: { url: p.dataUrl || `data:image/png;base64,${Buffer.from(p.data).toString("base64")}` },
    })),
  ];

  try {
    const chat = await llm.client.chat.completions.create({
      model: llm.model,
      messages: [{ role: "user", content }],
      max_tokens: 4096,
      temperature: 0,
    });
    const text = String(chat.choices?.[0]?.message?.content || "").trim();
    if (text.length >= MIN_TEXT_CHARS) return text;
  } catch (err) {
    if (isVisionUnsupportedError(err)) {
      const e = new Error(OCR_UNSUPPORTED_MSG);
      e.status = 400;
      throw e;
    }
    console.error("[resume-upload] OCR failed:", err.message || err);
    const e = new Error(OCR_UNSUPPORTED_MSG);
    e.status = 400;
    throw e;
  }

  const err = new Error(OCR_UNSUPPORTED_MSG);
  err.status = 400;
  throw err;
}

async function extractPdfText(buffer) {
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    let text = String(result?.text || "").trim();
    if (text.length >= OCR_TRIGGER_CHARS) return text;

    // 文本层过短：按页截图后走 DeepSeek OCR
    let shot;
    try {
      shot = await parser.getScreenshot({ scale: 1.4 });
    } catch (err) {
      console.warn("[resume-upload] getScreenshot failed:", err.message || err);
      return text;
    }
    const pages = (shot?.pages || []).slice(0, MAX_OCR_PAGES).filter((p) => p?.dataUrl || p?.data);
    if (!pages.length) return text;

    return await ocrPagesWithDeepSeek(pages);
  } finally {
    try {
      await parser.destroy?.();
    } catch {
      // ignore
    }
  }
}

async function extractText(kind, buffer) {
  if (kind === "pdf") {
    return extractPdfText(buffer);
  }
  if (kind === "md") {
    return buffer.toString("utf8").replace(/\u0000/g, "").trim();
  }
  if (kind === "docx") {
    assertDocxZipSafe(buffer);
    const result = await mammoth.extractRawText({ buffer });
    return String(result?.value || "").replace(/\u0000/g, "").trim();
  }
  const err = new Error("不支持的文件类型");
  err.status = 400;
  throw err;
}

function normalizeExtractedText(text) {
  const cleaned = String(text || "")
    .replace(/\u0000/g, "")
    .replace(/\r\n/g, "\n")
    .trim();
  if (cleaned.length < MIN_TEXT_CHARS) {
    const err = new Error(
      "未能从文件中提取足够文本（可能是扫描件/空文档）。请换可选中文字的 PDF/Word，或粘贴文本。"
    );
    err.status = 400;
    throw err;
  }
  if (cleaned.length > RESUME_MAX_TEXT_CHARS) {
    return cleaned.slice(0, RESUME_MAX_TEXT_CHARS);
  }
  return cleaned;
}

/**
 * 大模型判别：是否为个人求职简历
 */
export async function assertLooksLikeResume(text, { client, model } = {}) {
  const sample = String(text || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 6000);
  if (sample.length < MIN_TEXT_CHARS) {
    const err = new Error(NOT_RESUME_MSG);
    err.status = 400;
    throw err;
  }

  let llmClient = client;
  let llmModel = model;
  if (!llmClient) {
    const builtin = getBuiltinLlm();
    if (!builtin) {
      console.warn("[resume-upload] skip resume check: no BUILTIN_API_KEY");
      return true;
    }
    llmClient = builtin.client;
    llmModel = builtin.model;
  }
  llmModel = normalizeChatModel(llmModel);

  const chat = await llmClient.chat.completions.create({
    model: llmModel,
    temperature: 0,
    max_tokens: 8,
    // v4 默认 thinking 会占满短 max_tokens，导致 content 为空
    thinking: { type: "disabled" },
    messages: [
      {
        role: "system",
        content:
          "You are a resume classifier. Decide if the user text is a personal job resume (name/education/experience/projects/skills). Encyclopedias, novels, papers, contracts, news, product docs are NOT resumes. Reply with exactly YES or NO. No other words.",
      },
      {
        role: "user",
        content: `Is the following text a personal job resume?\n\n---\n${sample}\n---`,
      },
    ],
  });

  const ans = String(chat.choices?.[0]?.message?.content || "").trim();
  const upper = ans.toUpperCase();
  const isYes =
    /^YES\b/.test(upper) ||
    (/^(是|是的|对)\b/.test(ans) && !/不是/.test(ans)) ||
    /是简历|属于简历/.test(ans);
  const isNo =
    /^NO\b/.test(upper) ||
    /^(否|不是)/.test(ans) ||
    /不是简历|不属于简历/.test(ans);
  if (!isYes || isNo) {
    const err = new Error(NOT_RESUME_MSG);
    err.status = 400;
    throw err;
  }
  return true;
}

/**
 * 解析上传缓冲并写入 token 缓存
 */
export async function processResumeUpload({
  buffer,
  fileName,
  mime,
  ip,
  skipRateLimit = false,
  skipResumeCheck = false,
} = {}) {
  cleanupUploads();
  if (!skipRateLimit) checkRateLimit(ip || "unknown");

  if (!Buffer.isBuffer(buffer)) {
    const err = new Error("无效的文件数据");
    err.status = 400;
    throw err;
  }
  if (buffer.length > RESUME_MAX_BYTES) {
    const err = new Error(`文件过大，最大允许 ${RESUME_MAX_BYTES / (1024 * 1024)}MB`);
    err.status = 413;
    throw err;
  }

  const safeName = sanitizeFileName(fileName);
  const kind = detectKind(safeName, mime);
  assertMagic(kind, buffer);

  const rawText = await extractText(kind, buffer);
  const text = normalizeExtractedText(rawText);

  if (!skipResumeCheck) {
    await assertLooksLikeResume(text);
  }

  const token = crypto.randomBytes(16).toString("hex");
  uploadStore.set(token, {
    text,
    fileName: safeName,
    kind,
    createdAt: Date.now(),
    ip: ip || "unknown",
  });

  return {
    token,
    fileName: safeName,
    kind,
    charCount: text.length,
    preview: text.slice(0, 120),
  };
}

export function getResumeUpload(token) {
  cleanupUploads();
  if (!token || typeof token !== "string") return null;
  return uploadStore.get(token) || null;
}

export function deleteResumeUpload(token) {
  if (token) uploadStore.delete(token);
}

export function decodeBase64File(data) {
  const raw = String(data || "").replace(/^data:[^;]+;base64,/, "");
  if (!raw || raw.length > RESUME_MAX_BYTES * 1.4) {
    const err = new Error("文件编码无效或过大");
    err.status = 413;
    throw err;
  }
  // 粗过滤非 base64
  if (!/^[A-Za-z0-9+/=\s]+$/.test(raw.slice(0, 200))) {
    const err = new Error("文件编码无效");
    err.status = 400;
    throw err;
  }
  return Buffer.from(raw, "base64");
}

export async function handleResumeUpload(req, res) {
  try {
    const body = req.body || {};
    const fileName = sanitizeFileName(body.fileName || body.filename || "resume");
    const mime = String(body.mime || body.contentType || "");
    const ip = clientIp(req);

    let buffer;
    if (body.fileBase64 || body.pdfBase64) {
      buffer = decodeBase64File(body.fileBase64 || body.pdfBase64);
    } else {
      return res.status(400).json({ error: "缺少文件内容" });
    }

    const result = await processResumeUpload({ buffer, fileName, mime, ip });
    return res.json({ ok: true, ...result });
  } catch (err) {
    console.error("[resume-upload]", err.message || err);
    return res.status(err.status || 500).json({ error: err.message || "上传失败" });
  }
}
