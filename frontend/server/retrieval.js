import { knowledgeDocs, knowledgeStats } from "./knowledge/store.js";
import { bm25Score } from "./knowledge/bm25.js";
import { isTargetUniversityQuestion } from "./knowledge/formatContext.js";
import { fetchEmbedding, cosineSimilarity, embeddingClient } from "./embeddings.js";
import { filterHistoryMessages } from "./agent/guards.js";

const QUERY_LEXICON = [
  "华为",
  "海思",
  "通软",
  "荣耀",
  "校招",
  "机考",
  "笔试",
  "通过线",
  "及格线",
  "分数线",
  "手撕",
  "面经",
  "面试",
  "测评",
  "入池",
  "保温",
  "部门面",
  "主管面",
  "投递",
  "实习",
  "offer",
  "分值",
  "编程题",
  "算法岗",
  "软开",
  "嵌入式",
  "hot100",
  "lchot100",
  "hwmj",
  "codefun",
];

const CJK_STOP_GRAMS = new Set([
  "什么",
  "怎么",
  "如何",
  "多少",
  "一下",
  "一些",
  "一个",
  "我们",
  "可以",
  "还有",
  "以及",
  "如果",
  "因为",
  "所以",
  "大概",
  "是否",
  "这个",
  "那个",
  "不是",
  "没有",
  "问题",
  "相关",
  "进行",
  "比较",
  "好的",
  "今天",
  "中午",
  "吃什",
  "无关",
  "乱码",
]);

export function tokenize(text) {
  const raw = String(text || "").toLowerCase();
  const spaced = raw.replace(/[^\u4e00-\u9fa5a-z0-9]+/g, " ").trim();
  const tokens = new Set();

  for (const part of spaced.split(/\s+/).filter(Boolean)) {
    const segments = part.match(/[a-z0-9]+|[\u4e00-\u9fa5]+/g) || [];
    for (const seg of segments) {
      if (/^[a-z0-9]+$/.test(seg)) {
        if (seg.length > 1) tokens.add(seg);
        continue;
      }
      for (let i = 0; i < seg.length; i++) {
        if (i + 1 < seg.length) {
          const g2 = seg.slice(i, i + 2);
          if (!CJK_STOP_GRAMS.has(g2)) tokens.add(g2);
        }
        if (i + 2 < seg.length) {
          const g3 = seg.slice(i, i + 3);
          if (!CJK_STOP_GRAMS.has(g3)) tokens.add(g3);
        }
      }
    }
  }

  for (const w of QUERY_LEXICON) {
    if (raw.includes(w)) tokens.add(w);
  }

  return Array.from(tokens).filter((t) => t.length >= 2);
}

function countSharedLexicon(question, doc) {
  const raw = String(question || "").toLowerCase();
  const hay = `${doc.title || ""} ${doc.sourceTitle || ""} ${doc.searchText || ""}`.toLowerCase();
  let n = 0;
  for (const w of QUERY_LEXICON) {
    if (raw.includes(w) && hay.includes(w)) n += 1;
  }
  return n;
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

export function inferQueryIntents(question) {
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
  if (
    q.includes("流程") ||
    q.includes("投递") ||
    q.includes("时间线") ||
    q.includes("入池") ||
    q.includes("目标院校") ||
    q.includes("院校清单")
  ) {
    intents.push("process");
  }
  if (q.includes("测评") || q.includes("性格") || q.includes("心理")) {
    intents.push("assessment");
  }
  if (q.includes("offer") || q.includes("入池") || q.includes("报批") || q.includes("定级")) {
    intents.push("offer");
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

export function buildRetrievalQuery(question, history) {
  const current = String(question || "").trim();
  const recentUsers = (Array.isArray(history) ? history : [])
    .filter((m) => m && m.role === "user" && typeof m.content === "string")
    .map((m) => String(m.content).trim().slice(0, 200))
    .filter(Boolean)
    .slice(-2);
  const parts = [];
  for (const p of [...recentUsers, current]) {
    if (!p) continue;
    if (parts.some((u) => u === p || u.includes(p) || p.includes(u))) continue;
    parts.push(p);
  }
  if (!parts.length && current) parts.push(current);
  return parts.join("\n").slice(0, 800);
}

const HISTORY_RECENT_MESSAGES = 12;
const HISTORY_MAX_USER_CHARS = 2000;
const HISTORY_MAX_ASSISTANT_CHARS = 1600;
const HISTORY_MAX_TOTAL_CHARS = 10000;
const HISTORY_SUMMARY_MAX_CHARS = 1200;

function clipHistoryMessage(m) {
  const max =
    m.role === "assistant" ? HISTORY_MAX_ASSISTANT_CHARS : HISTORY_MAX_USER_CHARS;
  return {
    role: m.role,
    content: String(m.content || "")
      .replace(/\u0000/g, "")
      .trim()
      .slice(0, max),
  };
}

function trimHistoryToBudget(messages, maxTotal = HISTORY_MAX_TOTAL_CHARS) {
  const out = [];
  let used = 0;
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    const len = m.content.length + 16;
    if (out.length > 0 && used + len > maxTotal) break;
    out.push(m);
    used += len;
  }
  return out.reverse();
}

function extractiveHistorySummary(olderMessages) {
  const bullets = [];
  for (const m of olderMessages) {
    if (m.role !== "user") continue;
    const line = String(m.content || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 160);
    if (!line) continue;
    bullets.push(`- 用户曾问：${line}`);
    if (bullets.length >= 8) break;
  }
  if (!bullets.length) {
    const last = olderMessages[olderMessages.length - 1];
    const fallback = String(last?.content || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 200);
    return fallback ? `更早对话涉及：${fallback}` : "（更早轮次已省略）";
  }
  return `以下为更早轮次的要点（已压缩，细节以最近对话为准）：\n${bullets.join("\n")}`.slice(
    0,
    HISTORY_SUMMARY_MAX_CHARS
  );
}

async function llmHistorySummary(client, model, olderMessages) {
  const digest = olderMessages
    .map((m) => `${m.role === "user" ? "用户" : "助手"}: ${String(m.content).slice(0, 280)}`)
    .join("\n")
    .slice(0, 6000);
  try {
    const chat = await client.chat.completions.create({
      model,
      temperature: 0,
      max_tokens: 280,
      thinking: { type: "disabled" },
      messages: [
        {
          role: "system",
          content:
            "将对话历史压缩为简洁中文摘要，保留：用户目标、关键约束、已确认结论、未解决问题。不要逐句复述，不超过 200 字。",
        },
        { role: "user", content: digest },
      ],
    });
    const text = String(chat.choices?.[0]?.message?.content || "")
      .trim()
      .slice(0, HISTORY_SUMMARY_MAX_CHARS);
    return text || extractiveHistorySummary(olderMessages);
  } catch (err) {
    console.warn("[agent] history summary fallback:", err.message || err);
    return extractiveHistorySummary(olderMessages);
  }
}

export function normalizeHistory(history, maxMessages = HISTORY_RECENT_MESSAGES) {
  const clipped = filterHistoryMessages(history).map(clipHistoryMessage);
  return trimHistoryToBudget(clipped.slice(-maxMessages));
}

export async function prepareModelHistory(history, { client, model } = {}) {
  const clipped = filterHistoryMessages(history).map(clipHistoryMessage);
  if (clipped.length <= HISTORY_RECENT_MESSAGES) {
    return { messages: trimHistoryToBudget(clipped), summarized: false };
  }

  const older = clipped.slice(0, -HISTORY_RECENT_MESSAGES);
  const recent = clipped.slice(-HISTORY_RECENT_MESSAGES);
  const olderChars = older.reduce((n, m) => n + m.content.length, 0);

  let summaryText;
  if (client && model && olderChars > 2500) {
    summaryText = await llmHistorySummary(client, model, older);
  } else {
    summaryText = extractiveHistorySummary(older);
  }

  const summaryPrefix = [
    {
      role: "user",
      content: `【对话前文摘要——供上下文参考，非当前问题】\n${summaryText}`,
    },
    {
      role: "assistant",
      content: "好的，我已了解之前的讨论要点。请继续你的问题。",
    },
  ];
  const budgetForRecent = Math.max(
    2000,
    HISTORY_MAX_TOTAL_CHARS - summaryPrefix.reduce((n, m) => n + m.content.length, 0)
  );
  return {
    messages: [...summaryPrefix, ...trimHistoryToBudget(recent, budgetForRecent)],
    summarized: true,
  };
}

const WEAK_RETRIEVAL_MATCH_THRESHOLD = 5;

export async function retrieveDocs(question, topK = 8) {
  const result = await retrieveDocsScored(question, topK);
  return result.docs;
}

export async function retrieveDocsScored(question, topK = 8) {
  const qTokens = expandQueryTokens(tokenize(question));
  const qStage = inferQuestionStage(question);
  const intents = inferQueryIntents(question);

  let qEmbedding = null;
  if (embeddingClient) {
    try {
      qEmbedding = await fetchEmbedding(question);
    } catch (err) {
      console.warn("[retrieve] embedding query failed:", err.message);
    }
  }

  const scores = knowledgeDocs.map((doc) => {
    let base = doc.pathPriority / 10;
    if (doc.platform === "bilibili" || doc.path.includes("knowledge/videos/")) base += 8;
    else if (doc.platform === "codefun2000") base += 6;

    let match = 0;
    let boost = 0;

    for (const t of qTokens) {
      if (doc.searchText.includes(t)) match += 3;
    }

    const bm25 = bm25Score(doc, qTokens, knowledgeStats);
    match += bm25 * 6;

    const titleText = [doc.title || "", doc.sourceTitle || ""].join(" ").toLowerCase();
    for (const t of qTokens) {
      if (titleText.includes(t)) match += 6;
    }

    if (doc.tags.some((tag) => qTokens.some((t) => String(tag).toLowerCase().includes(t)))) {
      match += 4;
    }

    if (doc.keywords.some((kw) => qTokens.some((t) => String(kw).toLowerCase().includes(t)))) {
      match += 5;
    }

    if (doc.stage && qStage && doc.stage.toLowerCase() === qStage) boost += 6;
    if (doc.questionType && qTokens.some((t) => doc.questionType.toLowerCase().includes(t))) match += 4;

    if (doc.policyEffective && qStage === "exam") boost += 8;

    if (intents.includes("experience")) {
      if (doc.path.includes("knowledge/experiences/platform/")) boost += 14;
      if (doc.path.includes("knowledge/experiences/") && doc.platform === "codefun2000") boost += 10;
      if (doc.path.includes("knowledge/process/") && doc.sourceUrl && doc.sourceUrl.includes("problemset/hw")) boost += 16;
      if (doc.keywords.includes("面经题库") || doc.keywords.includes("面经")) boost += 8;
    }

    if (intents.includes("exam")) {
      const prepAsk = /准备|备考|刷题|规划|怎么学|如何学|冲刺|会考什么|考什么|题型/.test(
        String(question || "")
      );
      const trackAsk = /AI\s*机考|非\s*AI|会考什么|考什么|岗位.*(AI|机考)|机考.*(AI|类型|方向)/i.test(
        String(question || "")
      );
      const exemptAsk =
        /免机考|免试|竞赛免|论文免|机考沿用|分数沿用|刷分/.test(String(question || ""));
      const acmIoAsk = /acm|输入输出|读写模板|scanf|标准输入/.test(String(question || "").toLowerCase());
      if (doc.path.includes("knowledge/videos/segments/")) boost += prepAsk ? 22 : 16;
      if (doc.path.includes("knowledge/coding-problems/acm-intro.md")) boost += acmIoAsk || prepAsk ? 20 : 12;
      if (doc.path.includes("knowledge/coding-problems/hot100/")) boost += prepAsk ? 6 : 14;
      if (doc.path.includes("knowledge/exam/")) boost += prepAsk ? 4 : 8;
      if (trackAsk && (doc.id === "hw-exam-ai-vs-nonai" || doc.path.includes("exam-ai-vs-nonai"))) {
        boost += 28;
      }
      if (exemptAsk && (doc.id === "hw-exam-exempt" || doc.path.includes("exam-exempt"))) {
        boost += 30;
      }
      if (doc.path.includes("knowledge/process/") && doc.sourceUrl && doc.sourceUrl.includes("problemset/hw")) {
        boost += 6;
      }
    }

    if (intents.includes("video") || intents.includes("process")) {
      if (doc.path.includes("knowledge/videos/segments/")) boost += 14;
    }

    if (isTargetUniversityQuestion(question)) {
      if (doc.id === "hw-codenote-p0102" || /\/P0102\.md$/i.test(doc.path)) {
        boost += 48;
      } else if (doc.path.includes("knowledge/codenote/hw_note/")) {
        boost += 8;
      } else if (doc.path.includes("knowledge/videos/segments/")) {
        boost -= 12;
      }
    }

    if (intents.includes("interview")) {
      if (doc.stage === "interview") boost += 10;
      if (doc.path.includes("knowledge/experiences/")) boost += 6;
    }

    if (qEmbedding && doc.embedding) {
      const sim = cosineSimilarity(qEmbedding, doc.embedding);
      match += sim * 25;
    }

    return { doc, score: base + match + boost, match };
  });

  scores.sort((a, b) => b.score - a.score);

  let ranked = scores;
  if (intents.includes("experience")) {
    const relevant = scores.filter((s) =>
      s.doc.path.includes("knowledge/experiences/") ||
      (s.doc.path.includes("knowledge/process/") && s.doc.sourceUrl && s.doc.sourceUrl.includes("problemset/hw"))
    );
    if (relevant.length >= 4) {
      ranked = relevant;
    }
  }

  if (
    intents.includes("exam") &&
    /准备|备考|刷题|规划|怎么学|如何学|冲刺/.test(String(question || ""))
  ) {
    const videos = scores.filter((s) => s.doc.path.includes("knowledge/videos/segments/"));
    if (videos.length >= 3) {
      const rest = scores.filter((s) => !s.doc.path.includes("knowledge/videos/segments/"));
      const mixed = [...videos.slice(0, Math.min(8, videos.length)), ...rest];
      const seen = new Set();
      ranked = [];
      for (const item of mixed) {
        const key = item.doc.id || item.doc.path;
        if (seen.has(key)) continue;
        seen.add(key);
        ranked.push(item);
        if (ranked.length >= Math.max(topK * 2, 16)) break;
      }
    }
  }

  const top = ranked.slice(0, topK);
  const topMatch = top[0]?.match ?? 0;
  const lexiconHits = top[0] ? countSharedLexicon(question, top[0].doc) : 0;
  const weak =
    top.length === 0 ||
    (topMatch < WEAK_RETRIEVAL_MATCH_THRESHOLD && lexiconHits === 0) ||
    (lexiconHits === 0 && topMatch < 18);
  return {
    docs: top.map((s) => s.doc),
    ranked: top,
    topMatch,
    lexiconHits,
    weak,
  };
}

export function selectCitationSources(ranked, {
  maxCitations = 4,
  minScoreRatio = 0.68,
  minMatchRatio = 0.6,
  minMatchAbs = 10,
} = {}) {
  if (!Array.isArray(ranked) || ranked.length === 0) return [];

  const topScore = Number(ranked[0].score) || 0;
  const topMatch = Number(ranked[0].match) || 0;
  const scoreFloor = topScore * minScoreRatio;
  const matchFloor = Math.max(topMatch * minMatchRatio, minMatchAbs);

  const picked = [];
  const seen = new Set();

  for (const item of ranked) {
    if (picked.length >= maxCitations) break;
    const doc = item?.doc;
    if (!doc) continue;
    const score = Number(item.score) || 0;
    const match = Number(item.match) || 0;

    const isTop = picked.length === 0;
    if (!isTop) {
      if (score < scoreFloor && match < matchFloor) continue;
      if (match < minMatchAbs) continue;
    } else if (match < Math.min(minMatchAbs, 6) && score < scoreFloor * 0.85) {
      break;
    }

    const key = String(doc.sourceUrl || doc.id || doc.title || "")
      .trim()
      .toLowerCase();
    const titleKey = String(doc.title || "")
      .trim()
      .toLowerCase();
    if (key && seen.has(key)) continue;
    if (titleKey && seen.has(`t:${titleKey}`)) continue;
    if (key) seen.add(key);
    if (titleKey) seen.add(`t:${titleKey}`);
    picked.push(doc);
  }

  return picked;
}
