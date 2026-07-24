import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const EXPERIENCES_DIR = path.join(ROOT, "knowledge", "experiences");
const OUT_FILE = path.join(ROOT, "frontend", "public", "experiences.json");
const SEMANTIC_TAGS_FILE = path.join(ROOT, "frontend", "public", "experience_semantic_tags.json");

/** 旧 frontmatter 里无区分度的展示词，卡片上不再显示 */
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

function loadSemanticTags() {
  try {
    const parsed = JSON.parse(fs.readFileSync(SEMANTIC_TAGS_FILE, "utf-8"));
    return parsed.docs || parsed || {};
  } catch {
    return {};
  }
}

/** 展示标签优先用 LLM 语义标签；没有则过滤掉旧垃圾词 */
function resolveDisplayTags(id, frontmatterTags, semanticDocs) {
  const tagged = semanticDocs[id];
  if (tagged && Array.isArray(tagged.labels)) {
    return tagged.labels.filter((t) => t && !TAG_BLOCKLIST.has(t));
  }
  return (Array.isArray(frontmatterTags) ? frontmatterTags : []).filter(
    (t) => t && !TAG_BLOCKLIST.has(t),
  );
}

/**
 * 岗位分类规则
 * - 同时从标题、tags、category、正文检索关键词
 * - strong 关键词权重更高；medium 更宽泛
 * - 按顺序匹配，同分保留更靠前的岗位（更具体）
 */
const ROLE_LABELS = {
  "software-development": "通用软件开发",
  ai: "AI大类",
  embedded: "嵌入式软件",
  "network-communication": "通信 / 网络",
  "test-qa": "测试",
};

const ROLE_RULES = [
  {
    role: "software-development",
    strong: [
      "通用软件开发",
      "软开",
      "软件开发",
      "软件工程",
      "软件开发工程师",
      "互联网",
      "java开发",
      "c++开发",
      "golang",
      "go开发",
      "前端",
      "前端开发",
      "后端",
      "后端开发",
      "web",
      "全栈",
      "云平台",
      "数字化",
      "it开发",
      "大数据开发",
      "数据工程师",
      "数据开发",
      "后端工程师",
      "前端工程师",
      "软件工程师",
      "软件研发",
    ],
    medium: [
      "java",
      "c++",
      "python",
      "go",
      "c语言",
      "c#",
      "开发工程师",
      "后台",
      "服务端",
      "app开发",
      "移动端",
      "安卓",
      "android",
      "ios",
    ],
  },
  {
    role: "ai",
    strong: [
      "算法工程师",
      "ai",
      "人工智能",
      "机器学习",
      "深度学习",
      "大模型",
      "推荐算法",
      "搜索算法",
      "图像算法",
      "视觉算法",
      "自然语言处理",
      "nlp",
      "cv",
      "数据挖掘",
      "推荐系统",
      "自动驾驶算法",
      "ai算法",
    ],
    medium: ["算法", "算法岗", "ai岗", "ai工程师", "智能"],
  },
  {
    role: "embedded",
    strong: [
      "嵌入式",
      "硬件工程师",
      "硬件开发",
      "fpga",
      "单片机",
      "物联网",
      "数字ic",
      "模拟ic",
      "芯片",
      "集成电路",
      "射频",
      "pcb",
      "硬件测试",
    ],
    medium: ["硬件", "电子", "微电子", "嵌入式软件", "嵌入式开发"],
  },
  {
    role: "network-communication",
    strong: [
      "通信工程师",
      "5g",
      "无线通信",
      "基带",
      "通信协议",
      "光通信",
      "通信工程",
      "移动通信",
      "无线",
      "传输",
      "核心网",
      "网络工程师",
    ],
    medium: [],
  },
  {
    role: "test-qa",
    strong: [
      "测试开发",
      "测开",
      "测试工程师",
      "软件测试",
      "自动化测试",
      "硬件测试",
    ],
    medium: ["测试"],
  },
];

function countMatches(text, keywords) {
  let c = 0;
  for (const kw of keywords) {
    if (text.includes(kw)) c++;
  }
  return c;
}

function scoreRole(titleText, content, rule) {
  const titleScore =
    countMatches(titleText, rule.strong) * 5 +
    countMatches(titleText, rule.medium) * 2;
  const contentScore =
    countMatches(content, rule.strong) * 2 +
    countMatches(content, rule.medium) * 1;
  return titleScore + contentScore;
}

function inferRole(data, content) {
  if (data.role && ROLE_LABELS[data.role]) {
    return data.role;
  }

  const title = extractTitle(content) || String(data.title || "");
  const category = String(data.category || "");
  const tags = Array.isArray(data.tags) ? data.tags.join(" ") : "";
  const titleText = `${title} ${category} ${tags}`.toLowerCase();
  const contentText = content.toLowerCase().slice(0, 10000);

  let bestRole = "software-development";
  let bestScore = 0;
  for (const rule of ROLE_RULES) {
    const s = scoreRole(titleText, contentText, rule);
    if (s > bestScore) {
      bestScore = s;
      bestRole = rule.role;
    }
  }

  return bestRole;
}

function extractTitle(content) {
  const match = content.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : "";
}

function extractSource(frontmatter) {
  const sources = Array.isArray(frontmatter.sources) ? frontmatter.sources : [];
  if (sources.length === 0) return null;
  const s = sources[0];
  return { platform: s.platform || "unknown", title: s.title || "", url: s.url || "" };
}

function walk(dir) {
  const files = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // Skip archived/filtered/backup directories
      if (entry.name.startsWith("_") || entry.name.startsWith(".")) continue;
      files.push(...walk(full));
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      files.push(full);
    }
  }
  return files;
}

const GRADE_RANK = { A: 4, B: 3, C: 2, D: 1 };

function getGradeRank(grade) {
  return GRADE_RANK[grade] || 0;
}

function build() {
  const files = walk(EXPERIENCES_DIR);
  const experiences = [];
  const semanticDocs = loadSemanticTags();

  for (const file of files) {
    const raw = fs.readFileSync(file, "utf-8");
    const { data, content } = matter(raw);
    if (data.kind !== "experience") continue;

    const source = extractSource(data);
    const role = inferRole(data, content);
    const id = data.id || path.basename(file, ".md");

    experiences.push({
      id,
      title: extractTitle(content) || source?.title || data.id || "",
      publishedAt: data.published_at || "",
      role,
      roleLabel: ROLE_LABELS[role],
      stage: data.stage || "",
      tags: resolveDisplayTags(id, data.tags || [], semanticDocs),
      sourceGrade: data.source_grade || "",
      platform: source?.platform || "",
      sourceUrl: source?.url || "",
      filePath: path.relative(ROOT, file).replace(/\\/g, "/"),
    });
  }

  experiences.sort((a, b) => {
    const dateA = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
    const dateB = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
    if (dateB !== dateA) return dateB - dateA;
    return getGradeRank(b.sourceGrade) - getGradeRank(a.sourceGrade);
  });

  const grouped = {};
  for (const role of Object.keys(ROLE_LABELS)) {
    grouped[role] = experiences.filter((e) => e.role === role);
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    total: experiences.length,
    roles: ROLE_LABELS,
    grouped,
    all: experiences,
  };

  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(payload, null, 2), "utf-8");

  console.log(`Built ${experiences.length} experiences -> ${path.relative(ROOT, OUT_FILE)}`);
  for (const [role, list] of Object.entries(grouped)) {
    console.log(`  ${ROLE_LABELS[role]} (${role}): ${list.length}`);
  }
}

build();
