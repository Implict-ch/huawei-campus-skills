import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import OpenAI from "openai";

const ROOT = process.cwd().endsWith("frontend") ? path.resolve(process.cwd(), "..") : process.cwd();
const EXPERIENCES_PUBLIC = path.join(ROOT, "frontend", "public", "experiences.json");
const HAND_TEAR_DATA = path.join(ROOT, "frontend", "tmp", "hand_tear_data.json");

/** 备选方案会话缓存：换一组时直接复用，不重新调模型 */
const planSessions = new Map();
const SESSION_TTL_MS = 30 * 60 * 1000;
const PLAN_COUNT = 6;

function getBuiltinConfig() {
  return {
    apiKey: process.env.BUILTIN_API_KEY || "",
    baseUrl: process.env.BUILTIN_BASE_URL || "https://api.deepseek.com/v1",
    model: process.env.BUILTIN_MODEL || "deepseek-chat",
  };
}

const ROLE_KEYWORDS = {
  "software-development": ["软件开发", "java", "c++", "前端", "后端", "web", "spring", "微服务", "数据库", "linux"],
  ai: ["算法", "ai", "人工智能", "机器学习", "深度学习", "大模型", "nlp", "cv", "计算机视觉", "推荐算法", "pytorch", "tensorflow"],
  embedded: ["嵌入式", "单片机", "fpga", "芯片", "硬件", "物联网", "stm32", "c语言", "rtos"],
  "network-communication": ["通信", "5g", "网络", "无线", "核心网", "数通", "协议", "射频"],
  "test-qa": ["测试", "测开", "自动化测试", "验证", "qa"],
};

const ROLE_HAND_TEAR_CATEGORIES = {
  "software-development": ["数组", "链表", "二叉树", "动态规划", "栈 / 队列", "堆", "字符串", "哈希", "图论", "滑动窗口", "双指针", "回溯", "贪心"],
  ai: ["机器学习", "深度学习", "大模型岗"],
  embedded: ["位运算", "数学", "数组", "链表", "字符串", "图论"],
  "network-communication": ["图论", "栈 / 队列", "链表", "数组", "贪心"],
  "test-qa": ["数组", "字符串", "哈希", "链表", "栈 / 队列"],
};

const ROLE_LABELS = {
  "software-development": "通用软件开发",
  ai: "AI大类",
  embedded: "嵌入式软件",
  "network-communication": "通信/网络",
  "test-qa": "测试",
};

/** Prompt Ensemble：多面试官角度模板 */
const ANGLES = [
  "从项目技术选型和难点切入，深挖为什么这样设计",
  "从项目数据量、性能优化和实际效果切入",
  "从团队协作、遇到的问题和解决方案切入",
  "从八股文基础概念与项目结合点切入",
  "从实际业务场景和算法/模型/架构选择切入",
  "从项目扩展性、可维护性和工程落地切入",
  "从压力面角度追问边界条件、失败案例和 trade-off",
  "从岗位匹配角度，把简历亮点转化成可验证的面试问题",
];

function loadJson(filePath, defaultValue = {}) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return defaultValue;
  }
}

function cleanupSessions() {
  const now = Date.now();
  for (const [id, session] of planSessions.entries()) {
    if (now - session.createdAt > SESSION_TTL_MS) planSessions.delete(id);
  }
}

function resolveClient(model, apiKey, baseUrl) {
  let finalApiKey = String(apiKey || "").trim();
  let finalBaseUrl = baseUrl ? String(baseUrl).trim() : "";
  let finalModel = model || "gpt-4o-mini";

  if (model === "builtin-deepseek") {
    const builtin = getBuiltinConfig();
    if (!builtin.apiKey) {
      const err = new Error("服务端未配置内置模型 API Key");
      err.status = 400;
      throw err;
    }
    finalApiKey = builtin.apiKey;
    finalBaseUrl = builtin.baseUrl;
    finalModel = builtin.model;
  } else if (!finalApiKey) {
    const err = new Error("缺少 API Key");
    err.status = 400;
    throw err;
  }

  return {
    client: new OpenAI({
      apiKey: finalApiKey,
      baseURL: finalBaseUrl || undefined,
      timeout: 90000,
      maxRetries: 1,
    }),
    finalModel,
  };
}

function inferRole(profile) {
  const text = [
    profile.targetRole || "",
    profile.summary || "",
    ...(profile.skills || []),
    ...(profile.projects || []).map((p) => `${p.name} ${p.techStack?.join(" ") || ""} ${p.description || ""}`),
  ]
    .join(" ")
    .toLowerCase();

  let bestRole = "software-development";
  let bestScore = 0;
  for (const [role, keywords] of Object.entries(ROLE_KEYWORDS)) {
    const score = keywords.reduce((sum, kw) => sum + (text.includes(kw.toLowerCase()) ? 1 : 0), 0);
    if (score > bestScore) {
      bestScore = score;
      bestRole = role;
    }
  }
  return bestRole;
}

function selectHandTearProblems(role, count = PLAN_COUNT) {
  const data = loadJson(HAND_TEAR_DATA, { problems: [] });
  const preferredCategories = ROLE_HAND_TEAR_CATEGORIES[role] || ROLE_HAND_TEAR_CATEGORIES["software-development"];
  const candidates = data.problems.filter((p) => preferredCategories.includes(p.category) && (p.codefun_url || p.leetcode_url));
  if (candidates.length === 0) return [];

  const byCategory = {};
  for (const p of candidates) {
    if (!byCategory[p.category]) byCategory[p.category] = [];
    byCategory[p.category].push(p);
  }
  const selected = [];
  const categories = Object.keys(byCategory).sort(() => Math.random() - 0.5);
  for (let i = 0; selected.length < count && i < categories.length * 3; i++) {
    const cat = categories[i % categories.length];
    const pool = byCategory[cat].filter((p) => !selected.includes(p));
    if (pool.length > 0) {
      selected.push(pool[Math.floor(Math.random() * pool.length)]);
    }
  }
  // 不够时从总池补齐
  while (selected.length < count && selected.length < candidates.length) {
    const left = candidates.filter((p) => !selected.includes(p));
    if (!left.length) break;
    selected.push(left[Math.floor(Math.random() * left.length)]);
  }
  return selected.slice(0, count);
}

function selectExperiences(role, keywords, count = 4) {
  const data = loadJson(EXPERIENCES_PUBLIC, { grouped: {} });
  const items = data.grouped?.[role] || [];
  if (!items.length) return [];

  const keywordSet = new Set(keywords.map((k) => k.toLowerCase()).filter(Boolean));
  const scored = items.map((it) => {
    const text = [it.title || "", ...(it.tags || [])].join(" ").toLowerCase();
    let score = 0;
    for (const kw of keywordSet) {
      if (text.includes(kw)) score += 1;
    }
    return { item: it, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, count).map((s) => s.item);
}

async function parseResumeWithLLM(client, model, resumeText) {
  const prompt = `请从以下简历中提取结构化信息，严格按照 JSON 格式返回，不要包含任何其他文字。

提取字段：
- targetRole: 目标岗位（字符串）
- summary: 简历整体概述（字符串，50字以内）
- skills: 技能列表（字符串数组）
- projects: 项目经历数组，每个项目包含 name（项目名称）、techStack（技术栈数组）、description（一句话描述）、highlight（项目亮点或难点，字符串）
- education: 学历信息（字符串，可选）

要求：
1. 如果简历中信息缺失，对应字段留空或空数组
2. 不要编造不存在的信息
3. 只返回 JSON，不要 markdown 代码块

简历内容：
${resumeText.slice(0, 8000)}`;

  const chat = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: "你是一个简历解析助手，只输出结构化 JSON。" },
      { role: "user", content: prompt },
    ],
    temperature: 0.1,
    max_tokens: 1800,
  });

  const raw = chat.choices?.[0]?.message?.content || "";
  const cleaned = raw.replace(/```json\s*|\s*```/g, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    return { targetRole: "", summary: "", skills: [], projects: [], education: "" };
  }
}

async function generatePlanWithLLM(client, model, profile, role, handTear, experiences, variant) {
  const angle = ANGLES[variant % ANGLES.length];

  const experienceSamples = experiences
    .slice(0, 3)
    .map((e) => `- ${e.title}（来源：/experiences/${e.role}/${e.id}）`)
    .join("\n");

  const handTearSamples = handTear
    .map((p) => `- ${p.title}：${p.codefun_url || p.leetcode_url}`)
    .join("\n");

  const prompt = `你是一名华为校招面试官。请根据以下简历和岗位方向，生成一套面试题。

岗位方向：${role}
简历概述：${profile.summary || "未提供"}
技能：${(profile.skills || []).join("、") || "未提供"}
项目经历：
${(profile.projects || [])
  .map((p) => `- ${p.name}：${p.description || ""}（技术栈：${(p.techStack || []).join("、")}，亮点：${p.highlight || ""}）`)
  .join("\n")}

生成角度：${angle}

参考面经：
${experienceSamples || "无"}

手撕题备选（必须从中选一题）：
${handTearSamples || "无"}

请严格按照以下 JSON 格式输出一套面试题，不要包含其他文字：
{
  "projectQuestions": ["问题1", "问题2", "问题3"],
  "eightPartQuestions": ["问题1", "问题2", "问题3"],
  "handTearQuestion": {
    "title": "手撕题标题",
    "url": "题目链接",
    "hint": "30字以内的提示或考点说明",
    "reason": "为什么推荐这道题（结合简历技能、项目或岗位方向，2-3句话）"
  }
}

要求：
1. projectQuestions 必须基于简历中的具体项目名称与技术细节，不能泛泛而谈
2. eightPartQuestions 要结合技能列表中的技术点，且问法要贴合本角度
3. handTearQuestion 必须从备选手撕题中选取，完整复制标题和 URL
4. 必须说明推荐这道手撕题的理由，理由要结合简历中的具体技能或项目
5. 不要编造不存在的项目或技术`;

  const chat = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: "你是华为校招技术面试官，擅长根据简历生成个性化面试题。" },
      { role: "user", content: prompt },
    ],
    temperature: 0.75,
    max_tokens: 1500,
  });

  const raw = chat.choices?.[0]?.message?.content || "";
  const cleaned = raw.replace(/```json\s*|\s*```/g, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    return {
      projectQuestions: ["请介绍一下你最有挑战的一个项目"],
      eightPartQuestions: ["请简述你最熟悉的一项核心技术"],
      handTearQuestion: handTear[0]
        ? {
            title: handTear[0].title,
            url: handTear[0].codefun_url || handTear[0].leetcode_url,
            hint: "",
            reason: "结合你的岗位方向，作为基础编程能力考察。",
          }
        : null,
    };
  }
}

function tokenize(text) {
  return new Set(
    String(text || "")
      .toLowerCase()
      .replace(/[^\u4e00-\u9fa5a-z0-9]+/g, " ")
      .split(/\s+/)
      .filter((t) => t.length >= 2)
  );
}

function jaccard(a, b) {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter += 1;
  return inter / (a.size + b.size - inter);
}

/** Judge：质量打分 + 近重复过滤 */
function judgeAndFilterPlans(plans, minKeep = 4) {
  const scored = plans.map((plan, idx) => {
    let score = 0;
    const pq = plan.projectQuestions || [];
    const eq = plan.eightPartQuestions || [];
    const ht = plan.handTearQuestion || null;

    if (pq.length >= 3) score += 3;
    else score += pq.length;
    if (eq.length >= 3) score += 2;
    else score += eq.length * 0.5;

    const generic = /请介绍一下你的项目|请简述你的技术栈|最有挑战/;
    for (const q of pq) {
      if (q && q.length >= 18 && !generic.test(q)) score += 1;
      if (q && q.length < 10) score -= 1;
    }
    if (ht?.title && ht?.url) score += 2;
    if (ht?.reason && ht.reason.length >= 20) score += 2;
    if (ht?.hint) score += 0.5;
    if (plan.angle) score += 0.5;

    const fingerprint = tokenize([...pq, ...eq, ht?.title || "", ht?.reason || ""].join(" "));
    return { plan, idx, score, fingerprint };
  });

  scored.sort((a, b) => b.score - a.score);

  const kept = [];
  for (const row of scored) {
    if (row.score < 4) continue;
    const tooSimilar = kept.some((k) => jaccard(k.fingerprint, row.fingerprint) >= 0.72);
    if (tooSimilar) continue;
    kept.push(row);
  }

  // 保底：至少留下 minKeep 套（按分数补）
  if (kept.length < minKeep) {
    for (const row of scored) {
      if (kept.find((k) => k.idx === row.idx)) continue;
      kept.push(row);
      if (kept.length >= minKeep) break;
    }
  }

  return kept.map((k, i) => ({
    ...k.plan,
    variant: i + 1,
    judgeScore: Number(k.score.toFixed(2)),
  }));
}

async function llmJudgeRerank(client, model, plans) {
  if (plans.length <= 3) return plans;
  const brief = plans
    .map((p, i) => {
      const pq = (p.projectQuestions || []).slice(0, 2).join(" / ");
      const ht = p.handTearQuestion?.title || "无";
      return `${i + 1}. 角度=${p.angle || ""}；项目问=${pq}；手撕=${ht}`;
    })
    .join("\n");

  try {
    const chat = await client.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content: "你是面试题质量评审。只输出 JSON 数组，如 [3,1,5]，按质量从高到低排列题号。",
        },
        {
          role: "user",
          content: `请对下列面试题方案排序，优先：具体贴合简历、不空洞、项目/八股/手撕互补、互相不重复。\n${brief}\n只输出题号数组：`,
        },
      ],
      temperature: 0.2,
      max_tokens: 200,
    });
    const raw = (chat.choices?.[0]?.message?.content || "").replace(/```json\s*|\s*```/g, "").trim();
    const order = JSON.parse(raw);
    if (!Array.isArray(order)) return plans;
    const seen = new Set();
    const reranked = [];
    for (const n of order) {
      const idx = Number(n) - 1;
      if (idx >= 0 && idx < plans.length && !seen.has(idx)) {
        seen.add(idx);
        reranked.push(plans[idx]);
      }
    }
    for (let i = 0; i < plans.length; i++) {
      if (!seen.has(i)) reranked.push(plans[i]);
    }
    return reranked.map((p, i) => ({ ...p, variant: i + 1 }));
  } catch {
    return plans;
  }
}

function formatPlanAsMarkdown(roleLabel, plan, experiences, meta = {}) {
  const lines = [
    `## 简历模拟面试（${roleLabel}）`,
    "",
    `**方案角度**：${plan.angle || "综合考察"}`,
    meta.totalPlans ? `\n> 本次共生成 ${meta.totalPlans} 套备选，已随机抽取第 ${(meta.selectedIndex ?? 0) + 1} 套。可点「换一组」切换。` : "",
    "",
    "### 项目提问",
    ...(plan.projectQuestions || []).map((q, i) => `${i + 1}. ${q}`),
    "",
    "### 八股文考点",
    ...(plan.eightPartQuestions || []).map((q, i) => `${i + 1}. ${q}`),
    "",
    "### 手撕题",
  ].filter((x) => x !== "");

  if (plan.handTearQuestion) {
    lines.push(
      `[${plan.handTearQuestion.title}](${plan.handTearQuestion.url})  ${
        plan.handTearQuestion.hint ? "— " + plan.handTearQuestion.hint : ""
      }`
    );
    if (plan.handTearQuestion.reason) {
      lines.push("", `**推荐理由**：${plan.handTearQuestion.reason}`);
    }
  } else {
    lines.push("未匹配到手撕题");
  }
  lines.push("", "---", "", "**参考面经**：");
  if (experiences && experiences.length > 0) {
    lines.push(...experiences.map((e) => `- [${e.title}](/experiences/${e.role}/${e.id})`));
  } else {
    lines.push("未匹配到相关面经");
  }
  lines.push("", "> 提示：点击下方「换一组」可从已生成备选中再抽一套；也可重新粘贴简历生成全新方案。");
  return lines.join("\n");
}

function sendSSE(res, data) {
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

async function streamAnswer(res, answer, meta) {
  if (meta) sendSSE(res, { meta });
  const chunkSize = 12;
  const delay = 12;
  for (let i = 0; i < answer.length; i += chunkSize) {
    sendSSE(res, { chunk: answer.slice(i, i + chunkSize) });
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
  sendSSE(res, { "[DONE]": true });
  res.end();
}

async function extractPdfText(buffer) {
  try {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    return (result.text || "").trim();
  } catch (err) {
    throw new Error(`PDF 解析失败：${err.message || "请改为粘贴文本"}`);
  }
}

async function handleReshuffle(req, res) {
  cleanupSessions();
  const { sessionId, excludeIndex } = req.body || {};
  const session = planSessions.get(sessionId);
  if (!session) {
    return res.status(404).json({ error: "备选方案已过期，请重新生成面试题" });
  }

  const used = session.usedIndexes || new Set();
  const candidates = session.plans
    .map((_, i) => i)
    .filter((i) => i !== excludeIndex && !used.has(i));
  const pool = candidates.length ? candidates : session.plans.map((_, i) => i).filter((i) => i !== excludeIndex);
  const fallbackPool = pool.length ? pool : session.plans.map((_, i) => i);
  const selectedIndex = fallbackPool[Math.floor(Math.random() * fallbackPool.length)];
  used.add(selectedIndex);
  session.usedIndexes = used;
  // 若都用过一轮，清空重来
  if (used.size >= session.plans.length) session.usedIndexes = new Set([selectedIndex]);

  const plan = session.plans[selectedIndex];
  const answer = formatPlanAsMarkdown(session.roleLabel, plan, session.experiences, {
    totalPlans: session.plans.length,
    selectedIndex,
  });

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.status(200);
  await streamAnswer(res, answer, {
    sessionId,
    selectedIndex,
    totalPlans: session.plans.length,
  });
}

export default async function handleResumeInterview(req, res) {
  const body = req.body || {};
  const { action, model, apiKey, baseUrl } = body;

  if (action === "reshuffle") {
    return handleReshuffle(req, res);
  }

  let resumeText = String(body.resumeText || "").trim();

  // 支持 PDF base64：{ pdfBase64: "..." }
  if (!resumeText && body.pdfBase64) {
    try {
      const buffer = Buffer.from(String(body.pdfBase64).replace(/^data:application\/pdf;base64,/, ""), "base64");
      resumeText = await extractPdfText(buffer);
    } catch (err) {
      return res.status(400).json({ error: err.message || "PDF 解析失败" });
    }
  }

  if (!resumeText) {
    return res.status(400).json({ error: "缺少简历内容" });
  }

  try {
    const { client, finalModel } = resolveClient(model, apiKey, baseUrl);

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.status(200);

    const profile = await parseResumeWithLLM(client, finalModel, resumeText);
    const role = inferRole(profile);
    const roleLabel = ROLE_LABELS[role];

    const keywords = [
      ...(profile.skills || []),
      ...(profile.projects || []).flatMap((p) => p.techStack || []),
      profile.targetRole || "",
    ];
    const experiences = selectExperiences(role, keywords, 4);
    const handTearPool = selectHandTearProblems(role, PLAN_COUNT);

    // 并行 Fan-out：一次生成多套
    const rawPlans = await Promise.all(
      Array.from({ length: PLAN_COUNT }, async (_, i) => {
        const handTear = handTearPool.length
          ? [handTearPool[i % handTearPool.length]]
          : [];
        const plan = await generatePlanWithLLM(client, finalModel, profile, role, handTear, experiences, i);
        return {
          ...plan,
          variant: i + 1,
          angle: ANGLES[i % ANGLES.length],
        };
      })
    );

    let plans = judgeAndFilterPlans(rawPlans, 4);
    plans = await llmJudgeRerank(client, finalModel, plans);
    if (!plans.length) plans = rawPlans;

    const selectedIndex = Math.floor(Math.random() * plans.length);
    const sessionId = crypto.randomBytes(8).toString("hex");
    cleanupSessions();
    planSessions.set(sessionId, {
      plans,
      roleLabel,
      experiences,
      createdAt: Date.now(),
      usedIndexes: new Set([selectedIndex]),
    });

    const selectedPlan = plans[selectedIndex];
    const answer = formatPlanAsMarkdown(roleLabel, selectedPlan, experiences, {
      totalPlans: plans.length,
      selectedIndex,
    });

    await streamAnswer(res, answer, {
      sessionId,
      selectedIndex,
      totalPlans: plans.length,
      role,
      roleLabel,
    });
  } catch (err) {
    console.error("[resume-interview] error", err);
    if (!res.headersSent) {
      return res.status(err.status || 500).json({ error: err.message || "生成面试题失败" });
    }
    sendSSE(res, { error: err.message || "生成面试题失败" });
    res.end();
  }
}
