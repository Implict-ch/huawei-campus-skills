import express from "express";
import cors from "cors";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";
import OpenAI from "openai";
import dotenv from "dotenv";
import handleResumeInterview from "./resumeInterview.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");

// 加载服务端环境变量（内置大模型配置）
dotenv.config({ path: path.join(__dirname, "../.env") });

const BUILTIN_API_KEY = process.env.BUILTIN_API_KEY || "";
const BUILTIN_BASE_URL = process.env.BUILTIN_BASE_URL || "https://api.deepseek.com/v1";
const BUILTIN_MODEL = process.env.BUILTIN_MODEL || "deepseek-chat";

// 可选：Embedding / 向量检索配置（用于 RAG 混合搜索）
// 方式 1：外部 API（OpenAI 等）， fastest，需要 API Key
// 方式 2：本地模型（Python 3.11 + sentence-transformers），无外部 API，首次启动需加载模型
const EMBEDDING_API_KEY = process.env.EMBEDDING_API_KEY || "";
const EMBEDDING_BASE_URL = process.env.EMBEDDING_BASE_URL || "https://api.openai.com/v1";
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || "text-embedding-3-small";
const LOCAL_EMBEDDING_MODEL = process.env.LOCAL_EMBEDDING_MODEL || "BAAI/bge-small-zh-v1.5";
const EMBEDDING_CACHE = path.join(ROOT, "frontend", "tmp", "knowledge-embeddings.json");
const USE_LOCAL_EMBEDDING = process.env.USE_LOCAL_EMBEDDING !== "false"; // 默认启用本地 embedding 作为 fallback
const embeddingApiEnabled = Boolean(EMBEDDING_API_KEY);
const embeddingClient = embeddingApiEnabled
  ? new OpenAI({ apiKey: EMBEDDING_API_KEY, baseURL: EMBEDDING_BASE_URL, timeout: 60000, maxRetries: 2 })
  : null;

const KNOWLEDGE_DIR = path.join(ROOT, "knowledge");
const EXPERIENCES_PUBLIC = path.join(ROOT, "frontend", "public", "experiences.json");
const HAND_TEAR_DATA = path.join(ROOT, "frontend", "tmp", "hand_tear_data.json");

const app = express();
app.use(cors());
app.use(express.json({ limit: "8mb" }));

const PORT = process.env.PORT || 3001;

// ───────────────────────────────────────────────────────────────────────────
// 面经语义标签（须在知识库索引之前加载，详情页 tags 会用它覆盖旧 frontmatter）
// ───────────────────────────────────────────────────────────────────────────
const TAG_BLOCKLIST = new Set([
  "校招",
  "实习",
  "机考",
  "面试",
  "流程",
  "测评",
  "推荐",
  "论文",
  "华为",
  "小红书",
  "CodeFun2000",
  "其他",
  "AI大类",
  "通用软件开发",
  "嵌入式软件",
  "通信 / 网络",
  "通信",
  "算法",
]);

const experienceKeywords = {};
const KEYWORDS_FILE = path.join(ROOT, "frontend", "public", "experience_keywords.json");
try {
  Object.assign(experienceKeywords, JSON.parse(fs.readFileSync(KEYWORDS_FILE, "utf-8")));
} catch (err) {
  console.warn("[keywords] failed to load", err.message);
}

const experienceSemanticTags = {};
const SEMANTIC_TAGS_FILE = path.join(ROOT, "frontend", "public", "experience_semantic_tags.json");
try {
  const parsed = JSON.parse(fs.readFileSync(SEMANTIC_TAGS_FILE, "utf-8"));
  Object.assign(experienceSemanticTags, parsed.docs || parsed);
  console.log(
    `[keywords] loaded semantic tags for ${Object.keys(experienceSemanticTags).length} docs (${parsed.method || "unknown"})`,
  );
} catch (err) {
  console.warn("[keywords] semantic tags not loaded, fallback to lexical filter:", err.message);
}

function resolveExperienceDisplayTags(id, frontmatterTags) {
  const tagged = experienceSemanticTags[id];
  if (tagged && Array.isArray(tagged.labels)) {
    return tagged.labels.filter((t) => t && !TAG_BLOCKLIST.has(String(t)));
  }
  return (Array.isArray(frontmatterTags) ? frontmatterTags : []).filter(
    (t) => t && !TAG_BLOCKLIST.has(String(t)),
  );
}

// 判断问题是否与算法/AI/大模型岗位相关
function isAiAlgorithmQuestion(question) {
  const q = question.toLowerCase();
  const keywords = [
    "算法", "ai", "人工智能", "机器学习", "深度学习", "大模型", "llm", "nlp", "cv",
    "computer vision", "自然语言处理", "推荐算法", "图像算法", "视觉算法", "神经网络",
    " transformer", "pytorch", "tensorflow", "grpo", "ppo", "k-means", "adamw", "fm",
  ];
  return keywords.some((k) => q.includes(k));
}

// 加载算法/AI 岗手撕题样本，供 Agent 推荐
function loadAiHandTearSamples() {
  try {
    const raw = fs.readFileSync(HAND_TEAR_DATA, "utf-8");
    const data = JSON.parse(raw);
    const problems = (data.problems || []).filter((p) => p.group === "算法/AI 岗");
    if (problems.length === 0) return "";
    const samples = problems
      .slice(0, 20)
      .map((p) => `- ${p.title}：${p.codefun_url}（分类：${p.category}）`)
      .join("\n");
    return `\n\n【算法/AI 岗手撕题样本（当用户问题涉及算法/AI/大模型时，可从下列题目中选取 2-3 道推荐，禁止编造 URL）】\n${samples}\n... 共 ${problems.length} 题`;
  } catch (err) {
    console.warn("[ai-hand-tear] failed to load samples", err.message);
    return "";
  }
}

// ───────────────────────────────────────────────────────────────────────────
// 1. 知识库索引（启动时加载，用于 Agent 检索）
// ───────────────────────────────────────────────────────────────────────────

const knowledgeDocs = [];
let knowledgeStats = { avgDL: 0, idf: {}, N: 0 };

function tokenizeForBm25(text) {
  return text
    .toLowerCase()
    .replace(/[^\u4e00-\u9fa5a-z0-9]+/g, " ")
    .split(" ")
    .filter((t) => t.length > 1 || /[\u4e00-\u9fa5]/.test(t));
}

function computeBm25Stats() {
  const N = knowledgeDocs.length;
  if (N === 0) return { avgDL: 0, idf: {}, N: 0 };

  const docsTerms = knowledgeDocs.map((doc) => tokenizeForBm25(doc.searchText));
  const docsLengths = docsTerms.map((terms) => terms.length);
  const avgDL = docsLengths.reduce((a, b) => a + b, 0) / N;

  const df = {};
  for (const terms of docsTerms) {
    const seen = new Set(terms);
    for (const t of seen) {
      df[t] = (df[t] || 0) + 1;
    }
  }

  const idf = {};
  for (const t in df) {
    idf[t] = Math.log(1 + (N - df[t] + 0.5) / (df[t] + 0.5));
  }

  for (let i = 0; i < N; i++) {
    const tf = {};
    for (const t of docsTerms[i]) {
      tf[t] = (tf[t] || 0) + 1;
    }
    knowledgeDocs[i].bm25 = { tf, length: docsLengths[i] };
  }

  return { avgDL, idf, N };
}

function bm25Score(doc, qTokens, stats) {
  if (!doc.bm25 || stats.N === 0) return 0;
  const { tf, length } = doc.bm25;
  const k1 = 1.5;
  const b = 0.75;
  let score = 0;
  for (const t of qTokens) {
    const f = tf[t] || 0;
    if (f === 0) continue;
    const idf = stats.idf[t] || 0;
    const denom = f + k1 * (1 - b + b * (length / stats.avgDL));
    score += idf * ((f * (k1 + 1)) / denom);
  }
  return score;
}

function walk(dir) {
  const files = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // 跳过备份 / 归档 / 临时目录（以下划线或点开头的目录）
      if (entry.name.startsWith("_") || entry.name.startsWith(".")) continue;
      files.push(...walk(full));
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      files.push(full);
    }
  }
  return files;
}

function computePathPriority(filePath) {
  const p = filePath.replace(/\\/g, "/");
  if (p.includes("knowledge/coding-problems/hot100/")) return 110;
  if (p.includes("knowledge/process/")) return 100;
  if (p.includes("knowledge/videos/segments/")) return 95;
  if (p.includes("knowledge/experiences/platform/")) return 90;
  if (p.includes("knowledge/exam/")) return 60;
  if (p.includes("knowledge/wiki/compiled/")) return 55;
  if (p.includes("knowledge/application/") || p.includes("knowledge/assessment/") || p.includes("knowledge/interview/") || p.includes("knowledge/roles/")) return 50;
  if (p.includes("knowledge/experiences/")) return 30;
  return 10;
}

async function buildKnowledgeIndex() {
  const files = walk(KNOWLEDGE_DIR);
  let loaded = 0;
  for (const file of files) {
    try {
      const raw = fs.readFileSync(file, "utf-8");
      const { data, content } = matter(raw);
      const source = Array.isArray(data.sources) && data.sources[0] ? data.sources[0] : {};
      const title = String(data.title || source.title || content.match(/^#\s+(.+)$/m)?.[1] || "").trim();
      const relPath = path.relative(ROOT, file).replace(/\\/g, "/");
      const docId = data.id || relPath;
      // 面经：卡片/详情标签与筛选关键词对齐（语义打标）；其它知识文档仍用 frontmatter
      const tags = relPath.includes("knowledge/experiences/")
        ? resolveExperienceDisplayTags(docId, data.tags || [])
        : Array.isArray(data.tags)
          ? data.tags
          : [];
      const keywords = Array.isArray(data.keywords) ? data.keywords : [];
      const searchText = [
        title,
        source.title || "",
        data.id || "",
        data.stage || "",
        data.role || "",
        data.question_type || "",
        data.policy_effective || "",
        tags.join(" "),
        keywords.join(" "),
        content.slice(0, 8000),
      ]
        .join(" ")
        .toLowerCase();

      knowledgeDocs.push({
        id: docId,
        title,
        path: relPath,
        sourceGrade: data.source_grade || "",
        stage: data.stage || "",
        role: data.role || "",
        questionType: data.question_type || "",
        policyEffective: data.policy_effective || "",
        updatedAt: data.updated_at || "",
        timeRange: data.time_range || "",
        bvid: data.bvid || "",
        timeStartSec: data.time_start_sec || 0,
        tags,
        keywords,
        platform: source.platform || "",
        sourceUrl: source.url || "",
        sourceTitle: source.title || "",
        publishedAt: data.published_at || "",
        pathPriority: computePathPriority(relPath),
        content,
        searchText,
      });
      loaded++;
    } catch (err) {
      console.warn("[index] skip", file, err.message);
    }
  }
  console.log(`[knowledge] indexed ${loaded} docs`);
  const platformCounts = {};
  for (const d of knowledgeDocs) {
    platformCounts[d.platform] = (platformCounts[d.platform] || 0) + 1;
  }
  console.log("[knowledge] platforms:", platformCounts);

  // 计算 BM25 统计量（关键词检索基础）
  knowledgeStats = computeBm25Stats();
  console.log(`[bm25] computed stats for ${knowledgeStats.N} docs, avgDL=${knowledgeStats.avgDL.toFixed(2)}`);

  // 生成 / 加载文档 embedding（用于混合搜索）
  const cache = loadEmbeddingCache();
  if (embeddingClient) {
    console.log(`[embedding] api mode, model=${EMBEDDING_MODEL}`);
    let generated = 0;
    let reused = 0;
    for (const doc of knowledgeDocs) {
      const key = doc.path;
      if (cache[key] && cache[key].model === EMBEDDING_MODEL && cache[key].embedding) {
        doc.embedding = cache[key].embedding;
        reused++;
        continue;
      }
      try {
        const embedding = await fetchApiEmbedding(doc.searchText);
        if (embedding) {
          cache[key] = { model: EMBEDDING_MODEL, embedding };
          doc.embedding = embedding;
          generated++;
        }
      } catch (err) {
        console.warn("[embedding] failed for", doc.path, err.message);
      }
      // 每生成 50 条保存一次缓存，避免中途崩溃全部丢失
      if (generated % 50 === 0 && generated > 0) {
        saveEmbeddingCache(cache);
      }
    }
    saveEmbeddingCache(cache);
    console.log(`[embedding] api: generated ${generated}, reused ${reused}, total ${knowledgeDocs.length}`);
  } else if (USE_LOCAL_EMBEDDING) {
    // 本地模式：加载 Python 预生成的文档 embedding；查询时由本地 worker 实时编码
    let loaded = 0;
    for (const doc of knowledgeDocs) {
      const key = doc.path;
      if (cache[key] && cache[key].embedding) {
        doc.embedding = cache[key].embedding;
        loaded++;
      }
    }
    if (loaded > 0) {
      console.log(`[embedding] local mode: loaded ${loaded} doc embeddings from cache (${LOCAL_EMBEDDING_MODEL})`);
    } else {
      console.log(`[embedding] local mode: no cache found. Run: npm run build-embeddings`);
    }
  } else {
    console.log("[embedding] disabled (set EMBEDDING_API_KEY or USE_LOCAL_EMBEDDING=true)");
  }
}

// 先构建知识库索引（含可选 embedding），完成后再启动 HTTP 服务
const startServer = () => {
  app.listen(PORT, () => {
    console.log(`[server] listening on http://localhost:${PORT}`);
  });
};

buildKnowledgeIndex()
  .then(startServer)
  .catch((err) => {
    console.error("[knowledge] failed to build index", err);
    process.exit(1);
  });

// ───────────────────────────────────────────────────────────────────────────
// 2. 面经 API
// ───────────────────────────────────────────────────────────────────────────

app.get("/api/experiences", (req, res) => {
  try {
    const data = JSON.parse(fs.readFileSync(EXPERIENCES_PUBLIC, "utf-8"));
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =============================================================================
// 面经「关键词 / 语义标签」筛选接口（标签数据已在文件顶部加载）
// =============================================================================

// 接口：返回某个岗位侧边栏该显示哪些标签
app.get("/api/experiences/role/:role/keywords", (req, res) => {
  try {
    const list = experienceKeywords[req.params.role] || [];
    res.json({
      keywords: list,
      // 告诉前端当前是语义模式还是旧的字面匹配模式
      method: Object.keys(experienceSemanticTags).length ? "llm_semantic" : "lexical",
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 接口：返回某个岗位的面经列表；带 ?keywords=大模型,手撕 时做筛选
app.get("/api/experiences/role/:role", (req, res) => {
  try {
    const data = JSON.parse(fs.readFileSync(EXPERIENCES_PUBLIC, "utf-8"));
    const role = req.params.role;
    let items = data.grouped?.[role] || [];

    const keywordsParam = req.query.keywords;
    if (keywordsParam) {
      // 用户选中的标签，如 ["大模型", "手撕"]
      const selected = keywordsParam.split(",").map((k) => k.trim()).filter(Boolean);
      const selectedLower = selected.map((k) => k.toLowerCase());

      // 别名表：仅在「没有语义标签」时用于正文撞词兜底
      const roleKeywords = experienceKeywords[role] || [];
      const aliasMap = new Map();
      for (const entry of roleKeywords) {
        aliasMap.set(entry.keyword.toLowerCase(), entry.aliases.map((a) => a.toLowerCase()));
      }
      const allAliases = selectedLower.flatMap((k) => aliasMap.get(k) || [k]);
      const useSemantic = Object.keys(experienceSemanticTags).length > 0;

      items = items.filter((item) => {
        if (useSemantic) {
          const tagged = experienceSemanticTags[item.id];
          const labels = Array.isArray(tagged?.labels) ? tagged.labels : [];
          if (labels.length > 0) {
            // 这篇已被 LLM 打过标：看用户选的标签是否落在 labels 里
            const labelSet = new Set(labels.map((l) => String(l).toLowerCase()));
            if (selectedLower.some((k) => labelSet.has(k))) return true;
            // 有标签但没命中 → 筛掉（保证语义精度）
            return false;
          }
        }
        // 这篇没有语义标签：退回旧逻辑，看正文/标题是否包含别名
        const doc = knowledgeDocs.find((d) => d.id === item.id);
        const text = doc ? `${doc.title || ""} ${doc.searchText || ""}` : `${item.title || ""}`;
        const textLower = text.toLowerCase();
        return allAliases.some((alias) => textLower.includes(alias));
      });
    }

    res.json({ items, role, total: items.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/experiences/:id", (req, res) => {
  const doc = knowledgeDocs.find((d) => d.id === req.params.id);
  if (!doc) {
    return res.status(404).json({ error: "experience not found" });
  }
  res.json(doc);
});

app.get("/api/hand-tear", (req, res) => {
  try {
    const file = path.join(ROOT, "frontend", "tmp", "hand_tear_data.json");
    const raw = fs.readFileSync(file, "utf-8");
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.send(raw);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ───────────────────────────────────────────────────────────────────────────
// 3. Agent 检索
// ───────────────────────────────────────────────────────────────────────────

function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^\u4e00-\u9fa5a-z0-9]+/g, " ")
    .split(" ")
    .filter((t) => t.length > 1 || /[\u4e00-\u9fa5]/.test(t));
}

function expandQueryTokens(tokens) {
  const synonyms = {
    通过线: ["及格线", "分数线"],
    及格线: ["通过线", "分数线"],
    机考: ["笔试"],
    笔试: ["机考"],
    手撕: ["编程题", "算法题"],
    面试: ["面经"],
    面经: ["面试经验", "经验分享", "面经题库"],
    投递: ["简历", "申请"],
  };
  const expanded = new Set(tokens);
  for (const t of tokens) {
    if (synonyms[t]) synonyms[t].forEach((s) => expanded.add(s));
  }
  return Array.from(expanded);
}

function inferQueryIntents(question) {
  const q = question.toLowerCase();
  const intents = [];
  if (q.includes("面经") || q.includes("面试经验") || q.includes("经验分享") || q.includes("高质量面经")) {
    intents.push("experience");
  }
  if (q.includes("机考") || q.includes("笔试") || q.includes("通过线") || q.includes("手撕") || q.includes("编程题") || q.includes("分值")) {
    intents.push("exam");
  }
  if (q.includes("视频") || q.includes("课程") || q.includes("公开课") || q.includes("课")) {
    intents.push("video");
  }
  if (q.includes("面试") && !intents.includes("experience")) {
    intents.push("interview");
  }
  if (q.includes("流程") || q.includes("投递") || q.includes("时间线") || q.includes("入池")) {
    intents.push("process");
  }
  return intents;
}

function inferQuestionStage(question) {
  const q = question.toLowerCase();
  if (q.includes("投递") || q.includes("简历") || q.includes("内推")) return "application";
  if (q.includes("机考") || q.includes("笔试") || q.includes("考试") || q.includes("通过线") || q.includes("分值")) return "exam";
  if (q.includes("测评") || q.includes("性格") || q.includes("心理")) return "assessment";
  if (q.includes("面试") || q.includes("一面") || q.includes("二面") || q.includes("主管面")) return "interview";
  if (q.includes("offer") || q.includes("录用") || q.includes("入池") || q.includes("报批")) return "offer";
  return "";
}

// ───────────────────────────────────────────────────────────────────────────
// Embedding / 向量检索辅助函数
// ───────────────────────────────────────────────────────────────────────────

async function fetchApiEmbedding(text) {
  if (!embeddingClient) return null;
  const input = text.slice(0, 8000); //  embedding 模型通常有 token 限制，截断至安全长度
  const res = await embeddingClient.embeddings.create({ model: EMBEDDING_MODEL, input });
  return res.data[0].embedding;
}

// 本地 embedding worker（Python 3.11 + sentence-transformers）
let localEmbeddingWorker = null;
let localEmbeddingReady = false;
let localEmbeddingRequestId = 0;
const localEmbeddingPending = new Map();

function startLocalEmbeddingWorker() {
  if (localEmbeddingWorker) return;
  console.log("[embedding-worker] starting local embedding worker (Python 3.11 + sentence-transformers)...");
  const proc = spawn("py", ["-3.11", "scripts/embedding_worker.py"], {
    cwd: ROOT,
    env: { ...process.env, HF_ENDPOINT: "https://hf-mirror.com", LOCAL_EMBEDDING_MODEL },
    stdio: ["pipe", "pipe", "pipe"],
  });

  let buffer = "";
  proc.stdout.on("data", (data) => {
    buffer += data.toString();
    let idx;
    while ((idx = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 1);
      try {
        const msg = JSON.parse(line);
        if (msg.status === "ready") {
          localEmbeddingReady = true;
          console.log("[embedding-worker] ready");
          continue;
        }
        const reqId = msg._requestId;
        if (reqId && localEmbeddingPending.has(reqId)) {
          const { resolve, reject } = localEmbeddingPending.get(reqId);
          localEmbeddingPending.delete(reqId);
          if (msg.error) reject(new Error(msg.error));
          else resolve(msg.embeddings);
        }
      } catch (err) {
        console.warn("[embedding-worker] bad line:", line, err.message);
      }
    }
  });

  proc.stderr.on("data", (data) => {
    const text = data.toString().trim();
    if (text) console.log("[embedding-worker]", text);
  });

  proc.on("exit", (code) => {
    console.log("[embedding-worker] exited with code", code);
    localEmbeddingWorker = null;
    localEmbeddingReady = false;
    for (const { reject } of localEmbeddingPending.values()) {
      reject(new Error("embedding worker exited"));
    }
    localEmbeddingPending.clear();
  });

  localEmbeddingWorker = proc;
}

async function fetchLocalEmbeddings(texts) {
  if (!USE_LOCAL_EMBEDDING) return null;
  if (!localEmbeddingWorker) startLocalEmbeddingWorker();

  // 等待 worker 加载完成（首次启动需下载/加载模型，约 10-30 秒）
  if (!localEmbeddingReady) {
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("embedding worker start timeout")), 120000);
      const check = setInterval(() => {
        if (localEmbeddingReady) {
          clearTimeout(timeout);
          clearInterval(check);
          resolve();
        }
      }, 100);
    });
  }

  const requestId = `${Date.now()}-${++localEmbeddingRequestId}`;
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      localEmbeddingPending.delete(requestId);
      reject(new Error("embedding worker timeout"));
    }, 60000);

    localEmbeddingPending.set(requestId, {
      resolve: (embeddings) => {
        clearTimeout(timeout);
        resolve(embeddings);
      },
      reject: (err) => {
        clearTimeout(timeout);
        reject(err);
      },
    });

    localEmbeddingWorker.stdin.write(JSON.stringify({ texts: Array.isArray(texts) ? texts : [texts], _requestId: requestId }) + "\n");
  });
}

async function fetchEmbedding(text) {
  if (embeddingClient) return fetchApiEmbedding(text);
  if (USE_LOCAL_EMBEDDING) {
    const embeddings = await fetchLocalEmbeddings([text]);
    return embeddings ? embeddings[0] : null;
  }
  return null;
}

function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function loadEmbeddingCache() {
  try {
    return JSON.parse(fs.readFileSync(EMBEDDING_CACHE, "utf-8"));
  } catch {
    return {};
  }
}

function saveEmbeddingCache(cache) {
  fs.mkdirSync(path.dirname(EMBEDDING_CACHE), { recursive: true });
  fs.writeFileSync(EMBEDDING_CACHE, JSON.stringify(cache, null, 2), "utf-8");
}

// ───────────────────────────────────────────────────────────────────────────
// 3.1 检索函数（关键词 + 向量混合搜索）
// ───────────────────────────────────────────────────────────────────────────

async function retrieveDocs(question, topK = 8) {
  const qTokens = expandQueryTokens(tokenize(question));
  const qStage = inferQuestionStage(question);
  const intents = inferQueryIntents(question);

  // 混合搜索：获取查询的 embedding 向量（若启用）
  let qEmbedding = null;
  if (embeddingClient) {
    try {
      qEmbedding = await fetchEmbedding(question);
    } catch (err) {
      console.warn("[retrieve] embedding query failed:", err.message);
    }
  }

  const scores = knowledgeDocs.map((doc) => {
    // 路径优先级基础分：让 exam / wiki / process 等卡片在同等匹配度下优先
    let score = doc.pathPriority / 10;

    // 内容/标题/token 匹配
    for (const t of qTokens) {
      if (doc.searchText.includes(t)) score += 3;
    }

    // BM25 统计相关性：比简单 token 包含更能反映词频和文档长度
    const bm25 = bm25Score(doc, qTokens, knowledgeStats);
    score += bm25 * 6;

    // 标题命中：只匹配标题/来源标题中包含完整查询词的情况
    const titleText = [doc.title || "", doc.sourceTitle || ""].join(" ").toLowerCase();
    for (const t of qTokens) {
      if (titleText.includes(t)) score += 6;
    }

    // 标签命中
    if (doc.tags.some((tag) => qTokens.some((t) => String(tag).toLowerCase().includes(t)))) {
      score += 4;
    }

    // keywords 命中：只匹配 keyword 包含完整查询词的情况，避免短词被长查询词误触
    if (doc.keywords.some((kw) => qTokens.some((t) => String(kw).toLowerCase().includes(t)))) {
      score += 5;
    }

    // 阶段/类型命中
    if (doc.stage && qStage && doc.stage.toLowerCase() === qStage) score += 6;
    if (doc.questionType && qTokens.some((t) => doc.questionType.toLowerCase().includes(t))) score += 4;

    // 政策类卡片优先
    if (doc.policyEffective && qStage === "exam") score += 8;

    // 自有平台（CodeFun2000 / B站）基础曝光，但不高到压住具体内容相关性
    if (doc.platform === "codefun2000") score += 6;
    if (doc.platform === "bilibili") score += 4;

    // 按问题意图做相关性加权：不能把 B站/题库 硬推给面经问题
    if (intents.includes("experience")) {
      if (doc.path.includes("knowledge/experiences/platform/")) score += 14;
      if (doc.path.includes("knowledge/experiences/") && doc.platform === "codefun2000") score += 10;
      if (doc.path.includes("knowledge/process/") && doc.sourceUrl && doc.sourceUrl.includes("problemset/hwmj")) score += 16;
      if (doc.keywords.includes("面经题库") || doc.keywords.includes("面经")) score += 8;
    }

    if (intents.includes("exam")) {
      if (doc.path.includes("knowledge/coding-problems/hot100/")) score += 14;
      if (doc.path.includes("knowledge/exam/")) score += 10;
      if (doc.path.includes("knowledge/videos/segments/")) score += 8;
      if (doc.path.includes("knowledge/process/") && doc.sourceUrl && doc.sourceUrl.includes("problemset/hwmj")) score += 6;
    }

    if (intents.includes("video")) {
      if (doc.path.includes("knowledge/videos/segments/")) score += 14;
    }

    if (intents.includes("interview")) {
      if (doc.stage === "interview") score += 10;
      if (doc.path.includes("knowledge/experiences/")) score += 6;
    }

    // 向量相似度：与关键词分数融合，形成混合搜索评分
    if (qEmbedding && doc.embedding) {
      const sim = cosineSimilarity(qEmbedding, doc.embedding);
      // 余弦相似度范围 [-1, 1]，通常实际为 [0, 1]；权重 25 使其与关键词命中权重可比
      score += sim * 25;
    }

    return { doc, score };
  });

  scores.sort((a, b) => b.score - a.score);

  // 面经类问题：只保留真正相关的面经/面经题库，避免把 lchot100/B站视频等无关内容喂给模型
  if (intents.includes("experience")) {
    const relevant = scores.filter((s) =>
      s.doc.path.includes("knowledge/experiences/") ||
      (s.doc.path.includes("knowledge/process/") && s.doc.sourceUrl && s.doc.sourceUrl.includes("problemset/hwmj"))
    );
    if (relevant.length >= 4) {
      return relevant.slice(0, topK).map((s) => s.doc);
    }
  }

  return scores.slice(0, topK).map((s) => s.doc);
}

function formatRetrieved(docs) {
  return docs
    .map((d, i) => {
      const sourceType = d.path.includes("knowledge/exam/")
        ? "exam 政策卡片"
        : d.path.includes("knowledge/wiki/compiled/")
          ? "聚合 Wiki"
          : d.path.includes("knowledge/process/")
            ? "平台流程"
            : d.path.includes("knowledge/videos/segments/")
              ? "B站公开课切片"
              : d.path.includes("knowledge/experiences/")
                ? "面经"
                : "结构化卡片";
      const policyLine = d.policyEffective ? `政策生效：${d.policyEffective}` : "";
      let sourceLine = d.sourceUrl
        ? `来源平台：${d.platform || "未知"} | 来源标题：${d.sourceTitle || d.title || ""} | URL：${d.sourceUrl}`
        : `来源平台：${d.platform || "未知"} | 来源标题：${d.sourceTitle || d.title || ""} | URL：未保存（需用户传入）`;
      if (d.platform === "bilibili" && d.timeRange) {
        sourceLine += ` | 时间段：${d.timeRange}`;
      }
      // 卡片类内容通常较短，可直接放全文；面经历较长，截取前 1200 字
      let contentPreview = d.content.length < 1500
        ? d.content
        : d.content.slice(0, 1200) + "...";

      // 手撕题库介绍：附加 index.json 中的具体题目，避免 AI 编造题目或 URL
      if (d.path.includes("knowledge/coding-problems/hot100/lchot100-intro.md")) {
        try {
          const idxPath = path.join(ROOT, "knowledge/coding-problems/hot100/index.json");
          const idx = JSON.parse(fs.readFileSync(idxPath, "utf-8"));
          const samples = idx.problems
            .filter((p) => p.title && p.source_url)
            .slice(0, 25)
            .map((p) => `- ${p.title}：${p.source_url}（章节：${p.chapter}）`)
            .join("\n");
          contentPreview += `\n\n【必须从下列题目中选取推荐，禁止编造 URL】\n${samples}\n... 共 ${idx.problems.length} 题`;
        } catch (err) {
          console.warn("[formatRetrieved] failed to load hot100 index", err.message);
        }
      }

      return [
        `【参考 ${i + 1}】${d.title || d.id}`,
        `文档类型：${sourceType}`,
        `证据等级：${d.sourceGrade || "未知"}`,
        policyLine,
        sourceLine,
        `更新日期：${d.updatedAt || d.publishedAt || "未知"}`,
        `内容：\n${contentPreview}`,
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n");
}

// 对 LLM 输出的 CodeFun2000 引用做后处理：把无链接的条目自动补成可点击链接
function postProcessCodeFunLinks(answer) {
  const urlMap = new Map();
  for (const doc of knowledgeDocs) {
    if (doc.platform === "codefun2000" || (doc.sourceUrl && doc.sourceUrl.includes("codefun2000.com"))) {
      const titles = [doc.title, doc.sourceTitle].filter(Boolean);
      for (const t of titles) {
        const normalized = t.replace(/《|》/g, "").trim().replace(/\s+/g, " ");
        urlMap.set(t, doc.sourceUrl);
        urlMap.set(normalized, doc.sourceUrl);
      }
    }
  }

  // 1. 处理 "- [B] CodeFun2000 面经：标题。" / "- [B] CodeFun2000 面经：标题"
  answer = answer.replace(
    /- \[([A-D])\] CodeFun2000\s*面经[：:]\s*([^。\n]+)/g,
    (match, grade, title) => {
      const t = title.trim().replace(/《|》/g, "").trim().replace(/\s+/g, " ");
      const url = urlMap.get(t) || urlMap.get(title.trim());
      return url ? `- [${grade}] [${title.trim()}](${url}) — CodeFun2000` : match;
    }
  );

  // 2. 处理 "- [B] 面经《标题》— CodeFun2000" / "- [B] 标题 — CodeFun2000"（无链接时）
  answer = answer.replace(
    /- \[([A-D])\] ((?!\[.*?\]\(.*?\))[^—\n]+?)(?:\s*)[—-] CodeFun2000/g,
    (match, grade, text) => {
      const t = text.trim().replace(/^面经\s*/, "").replace(/《|》/g, "").trim().replace(/\s+/g, " ");
      const url = urlMap.get(t) || urlMap.get(text.trim().replace(/《|》/g, "").trim().replace(/\s+/g, " "));
      return url ? `- [${grade}] [${t}](${url}) — CodeFun2000` : match;
    }
  );

  return answer;
}

const SYSTEM_PROMPT = `你是华为校招智能助手（hw-campus-skills）。请严格根据下面提供的参考资料回答用户关于华为校招投递、机考、测评、面试、offer 的问题。

判断与检索规则：
1. 先判断问题阶段和类型：投递 / 机考 / 测评 / 面试 / offer。
2. 按优先级使用参考资料：
   - 政策类（机考分值、通过线、机会次数、测评门槛）：优先使用「exam 政策卡片」中带 policy_effective 的最新资料；面经中的历史分值仅作背景。
   - 自有内容：CodeFun2000 平台流程 / 题库 / 站内面经、塔子哥 B 站公开课切片。
   - 精编/聚合：聚合 Wiki、application、assessment、interview、roles 等结构化卡片。
   - 单篇面经：牛客/小红书面经仅作补充或交叉验证，并降级表述。
3. 只根据检索到的条目回答；没有依据时明确说「知识库无法确认」，禁止编造内部机制。

输出格式（必须严格遵循 SKILL.md）：

## 结论
[2-4 句直接回答，给出明确结论]

## 具体怎么做
[3-5 条，覆盖分值结构、通过标准、准备建议、后续动作]
1. ...
2. ...

### 依据与边界
[可选：一句纯文字边界说明，不带 [A/B/C/D]]
- [A/B/C] [CodeFun2000 标题](https://codefun2000.com/ide/Pxxxx) — CodeFun2000
- [A] 塔子哥公开课 [集标题](https://www.bilibili.com/video/BVxxx?t=秒) — B站 **MM:SS–MM:SS**
- [C] 牛客面经《...》
- [C] 小红书面经《...》

## 相关提醒
[2-3 条相关点]

引用规则（面向客户）：
- 只能引用下面「参考资料」中实际出现的内容；禁止编造不存在的来源、URL 或 B站时间段。
- 依据与边界应列出 4 条来源（资料不足时可少于 4 条）。顺序：优先使用与问题直接相关的来源；前两条尽量来自我们自己的 CodeFun2000 / B站 内容（仅当与问题直接相关时），后两条可用牛客/小红书面经补充。禁止为了凑数放不相关来源。
- 不要为了凑自有来源而引用与问题无关的 B站视频或 lchot100 题库。例如：问面经时优先引用 hwmj 面经题库 / 站内面经；问机考/手撕题时优先引用 lchot100 / B站备考视频；问课程/视频时优先引用 B站公开课。
- 当用户问「有哪些高质量面经」或「推荐面经」时，结论必须直接列出/推荐 CodeFun2000 上的面经资源（hwmj 面经题库与站内精选面经），并给出可点击链接；不要只写面试准备方法论。
- B站固定标 [A]，且必须写成：- [A] 塔子哥公开课 [集标题](https://www.bilibili.com/video/BVxxx?t=秒) — B站 **MM:SS–MM:SS**。缺少「塔子哥公开课」四字视为格式错误；时间段必须取自片段 frontmatter；如果参考资料中没有「B站公开课切片」，就不要写 B站条目。
- 牛客/小红书只写平台名 + 标题，禁止在回答中粘贴 nowcoder.com / xiaohongshu.com 链接。
- exam 政策卡片 / 聚合 Wiki 属于站内整理，仅用于生成答案内容；在「依据与边界」中不要直接写卡片名称/id，而要写其来源条目中的 CodeFun2000 / B站 / 牛客 / 小红书。若卡片没有可引用的原始来源（极少见），才可写为 [B] 卡片标题。
- CodeFun2000 来源必须输出可点击链接。格式必须是："- [A/B] [标题](URL) — CodeFun2000"。如果参考资料中 CodeFun2000 条目的 URL 为"未保存（需用户传入）"，则禁止编造 URL，在依据与边界中直接写："- [B] 我传进来 — CodeFun2000"。禁止把 CodeFun2000 来源写成不带链接的纯文字描述（如"- [B] CodeFun2000 面经《xxx》"）。
- 手撕题推荐规则：
   - 通用工程岗位（软开/嵌入式/通信/测试等）：必须引用 lchot100 题库首页 [A] [ACM 模式 Hot 100 手撕题库](https://codefun2000.com/problemset/lchot100) — CodeFun2000；具体题目从参考资料中 lchot100-intro 下方的【必须从下列题目中选取推荐，禁止编造 URL】列表里选取 2-3 道，禁止自己构造 URL/PID。
   - 算法 / AI / 大模型 / 机器学习 / 深度学习岗位：必须引用算法岗手撕题集首页 [A] [华为算法岗手撕题集](https://codefun2000.com/pset/edit/69099e4c3bd8d8fad614f06d) — CodeFun2000；具体题目从参考资料中【算法/AI 岗手撕题样本】列表里选取 2-3 道，完整复制标题和 URL，禁止自己构造或改写 URL/PID。
   - 禁止出现标题与 URL 不对应的情况。
   - 不要写成 hwmj 面经题库。
- 若问题涉及机考/面试流程与准备，hwmj 题库内的「入门教程」也可作为 CodeFun2000 来源引用，链接：https://codefun2000.com/problemset/hwmj（仅用于流程说明，不用于手撕题推荐）。
- 不要把知识库文件名、卡片 id、路径或「政策卡片」「知识库」「2026政策卡片」等内部描述写入回答。
- 不要向客户复述 A/B/C/D 等级定义说明。
- 禁止在回答中出现「字幕」二字。

正确示例：
- [A] 塔子哥公开课 [华为校招AI机考备考指南|高效上岸版](https://www.bilibili.com/video/BV19JNb6SELo?t=0) — B站 **00:00–02:01**
- [A] [ACM 模式 Hot 100 手撕题库](https://codefun2000.com/problemset/lchot100) — CodeFun2000
- [B] [10.18线下面试，平均45分钟一轮](https://codefun2000.com/ide/P2418) — CodeFun2000
- [B] [三小时三面速通，体验感很好，面试官都很和蔼，没有压力面](https://codefun2000.com/ide/P2429) — CodeFun2000
- [C] 牛客面经《华为校招机考备考全攻略》
- [C] 小红书面经《华为机考200分过线经验分享》

错误示例：
- [B] 华为机考形式与分值（2026）——直接写内部卡片名称
- [B] hw-exam-format — 2026政策卡片
- [A] [华为校招&实习面经手撕题库](https://codefun2000.com/problemset/hwmj) — CodeFun2000（手撕题应使用 lchot100）
- [B] 面经《10.18线下面试，平均45分钟一轮》— CodeFun2000（CodeFun2000 必须带可点击 URL，错误）

现在请参考以下资料作答：`;

// ───────────────────────────────────────────────────────────────────────────
// 4. Agent 对话 API + 简历模拟面试 API
// ───────────────────────────────────────────────────────────────────────────

app.post("/api/resume-interview", handleResumeInterview);

app.post("/api/agent", async (req, res) => {
  const { question, history, apiKey, model, baseUrl } = req.body;
  if (!question?.trim()) {
    return res.status(400).json({ error: "缺少 question" });
  }

  let finalApiKey = String(apiKey || "").trim();
  let finalBaseUrl = baseUrl ? String(baseUrl).trim() : "";
  let finalModel = model || "gpt-4o-mini";
  let usingBuiltin = false;

  if (model === "builtin-deepseek") {
    if (!BUILTIN_API_KEY) {
      return res.status(400).json({ error: "服务端未配置内置模型 API Key" });
    }
    finalApiKey = BUILTIN_API_KEY;
    finalBaseUrl = BUILTIN_BASE_URL;
    finalModel = BUILTIN_MODEL;
    usingBuiltin = true;
  } else if (!finalApiKey) {
    return res.status(400).json({ error: "缺少 API Key" });
  }

  try {
    const client = new OpenAI({
      apiKey: finalApiKey,
      baseURL: finalBaseUrl || undefined,
      timeout: 30000,
      maxRetries: 0,
    });

    const retrieved = await retrieveDocs(question, 12);
    let context = formatRetrieved(retrieved);
    if (isAiAlgorithmQuestion(question)) {
      context += loadAiHandTearSamples();
    }

    const historyMessages = Array.isArray(history)
      ? history.filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      : [];

    const messages = [
      { role: "system", content: SYSTEM_PROMPT + "\n\n" + context },
      ...historyMessages,
      { role: "user", content: question },
    ];

    const chat = await client.chat.completions.create({
      model: finalModel,
      messages,
      temperature: 0.3,
      max_tokens: 1500,
      stream: true,
    });

    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.status(200);

    let fullAnswer = "";
    for await (const chunk of chat) {
      const delta = chunk.choices?.[0]?.delta?.content || "";
      if (!delta) continue;
      fullAnswer += delta;
      res.write(`data: ${JSON.stringify({ chunk: delta, done: false })}\n\n`);
    }

    const answer = postProcessCodeFunLinks(fullAnswer);
    // 如果后处理有变化，补发一个最终修正后的完整内容
    if (answer !== fullAnswer) {
      res.write(`data: ${JSON.stringify({ answer, done: false, replace: true })}\n\n`);
    }

    const retrievedMeta = retrieved.map((d) => ({ id: d.id, title: d.title, sourceUrl: d.sourceUrl }));
    res.write(`data: ${JSON.stringify({ done: true, retrieved: retrievedMeta })}\n\n`);
    res.end();
  } catch (err) {
    console.error("[agent] error", err);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message || "调用模型失败" });
    } else {
      res.write(`data: ${JSON.stringify({ error: err.message || "调用模型失败", done: true })}\n\n`);
      res.end();
    }
  }
});

app.get("/api/health", (req, res) => res.json({ ok: true }));
