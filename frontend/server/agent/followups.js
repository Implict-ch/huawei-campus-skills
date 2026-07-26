const FOLLOWUP_POOLS = {
  dual_camera: [
    {
      text: "考完怎么查询机考成绩和通过凭证？",
      coveredIf: /查(询)?(机考)?成绩|通过凭证|次日上午.*成绩/,
    },
    {
      text: "机考第二机位断连了怎么办？",
      coveredIf: /第二机位断|断连|不弹窗/,
    },
    {
      text: "机考通过线大概是多少？",
      coveredIf: /通过线|过线|200\s*分/,
    },
  ],
  exam: [
    {
      text: "华为机考双机位怎么摆放？",
      coveredIf:
        /双机位.*(摆|放|要求|示意)|怎么摆|摆放要求|第一机位|第二机位.*(拍|位置|后方)|官方邮件/,
    },
    {
      text: "考完怎么查机考成绩？",
      coveredIf: /查(询)?(机考)?成绩|通过凭证|次日上午/,
    },
    {
      text: "机考通过后下一步是什么？",
      coveredIf: /通过后|机考通过.*面试|不等于一定安排面试/,
    },
    {
      text: "性格测评要注意什么？",
      coveredIf: /性格测评|测评攻略|心理测评/,
    },
  ],
  process: [
    {
      text: "华为校招机考形式和分值是怎样的？",
      coveredIf: /机考形式|分值结构|acm|通过线/,
    },
    {
      text: "怎么判断我是 AI 还是非 AI 机考？",
      coveredIf: /岗位名.*AI|出现.*AI|非\s*AI\s*机考|如何判断.*(AI|卷种)/,
    },
    {
      text: "性格测评攻略有哪些？",
      coveredIf: /性格测评|测评攻略/,
    },
    {
      text: "校招面试一般几轮、怎么准备？",
      coveredIf: /几轮|技术面|主管面|三轮/,
    },
  ],
  interview: [
    {
      text: "面试手撕一般考什么？",
      coveredIf: /手撕.*(考|高频|题)/,
    },
    {
      text: "有哪些高质量面经可以看？",
      coveredIf: /高质量面经|面经题库|hwmj|推荐面经/,
    },
    {
      text: "泡池子/排序阶段是什么意思？",
      coveredIf: /泡池子|排序阶段|入池/,
    },
  ],
  experience: [
    {
      text: "通软和海思面试流程有什么区别？",
      coveredIf: /通软|海思/,
    },
    {
      text: "面试手撕高频考点有哪些？",
      coveredIf: /手撕.*高频|高频考点/,
    },
    {
      text: "机考备考应该怎么规划？",
      coveredIf: /备考规划|刷题|七天/,
    },
  ],
  assessment: [
    {
      text: "测评一般在流程的哪一步？",
      coveredIf: /测评.*(步骤|流程|时机)|性格测评/,
    },
    {
      text: "机考通过后多久安排面试？",
      coveredIf: /通过后.*面试|安排面试/,
    },
    {
      text: "校招面试一般几轮？",
      coveredIf: /几轮|技术面|主管面/,
    },
  ],
  offer: [
    {
      text: "入池和报批是什么意思？",
      coveredIf: /入池|报批/,
    },
    {
      text: "拿到意向后还要注意什么？",
      coveredIf: /意向|offer|开奖/,
    },
    {
      text: "校招整体流程还可以补哪些环节？",
      coveredIf: /整体流程|时间线/,
    },
  ],
  video: [
    {
      text: "机考备考应该怎么规划？",
      coveredIf: /备考规划|刷题/,
    },
    {
      text: "有哪些高质量面经可以看？",
      coveredIf: /高质量面经|面经题库|推荐面经/,
    },
    {
      text: "面试手撕一般考什么？",
      coveredIf: /手撕.*(考|高频)/,
    },
  ],
  default: [
    {
      text: "华为校招整体流程是怎样的？",
      coveredIf: /整体流程|投递.*机考.*面试|校招流程/,
    },
    {
      text: "机考备考应该怎么规划？",
      coveredIf: /备考规划|刷题规划/,
    },
    {
      text: "有哪些高质量面经可以看？",
      coveredIf: /高质量面经|面经题库|推荐面经/,
    },
  ],
};

function normalizeSuggestKey(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[\s？?！!。，,、·…#*`>\-\[\]()]+/g, "")
    .slice(0, 96);
}

function collectAskedSuggestKeys(question, history) {
  const keys = new Set();
  const add = (t) => {
    const k = normalizeSuggestKey(t);
    if (k) keys.add(k);
  };
  add(question);
  for (const m of Array.isArray(history) ? history : []) {
    if (m?.role === "user" && typeof m.content === "string") add(m.content);
  }
  return keys;
}

function collectConversationCorpus(question, answer, history) {
  const parts = [];
  if (question) parts.push(String(question));
  if (answer) parts.push(String(answer));
  for (const m of Array.isArray(history) ? history : []) {
    if (m?.content) parts.push(String(m.content));
  }
  return parts.join("\n").toLowerCase();
}

function wasAlreadyAsked(candidate, askedKeys) {
  const key = normalizeSuggestKey(candidate);
  if (!key) return true;
  if (askedKeys.has(key)) return true;
  for (const a of askedKeys) {
    if (!a || a.length < 6) continue;
    if (a.includes(key) || key.includes(a)) return true;
  }
  return false;
}

function isSuggestionCovered(item, askedKeys, corpus) {
  const text = typeof item === "string" ? item : item?.text;
  if (!text) return true;
  if (wasAlreadyAsked(text, askedKeys)) return true;
  const rule = typeof item === "object" ? item.coveredIf : null;
  if (rule instanceof RegExp && corpus && rule.test(corpus)) return true;
  const core = normalizeSuggestKey(text).replace(/华为|校招|一般|怎么|什么|哪些|有没有/g, "");
  if (core.length >= 4) {
    const hits = ["双机位", "摆放", "成绩", "通过线", "测评", "手撕", "面经", "面试", "流程", "入池"].filter(
      (w) => core.includes(w) && corpus.includes(w)
    );
    if (core.includes("摆放") && /摆放|第一机位|第二机位/.test(corpus)) return true;
    if (hits.length >= 2) return true;
  }
  return false;
}

/**
 * 主题取自「当前问题」；去重同时看问题、回答与历史是否已覆盖。
 */
export function buildSuggestedFollowups({
  question,
  answer = "",
  history,
  citationDocs,
  intents = [],
}) {
  const askedKeys = collectAskedSuggestKeys(question, history);
  const corpus = collectConversationCorpus(question, answer, history);
  const blob = String(question || "").toLowerCase();

  const topics = [];
  if (/双机位|第二机位|摆放/.test(blob)) topics.push("dual_camera");
  for (const intent of intents) {
    if (FOLLOWUP_POOLS[intent] && !topics.includes(intent)) topics.push(intent);
  }
  if (/测评|性格/.test(blob) && !topics.includes("assessment")) topics.push("assessment");
  if (/offer|入池|报批/.test(blob) && !topics.includes("offer")) topics.push("offer");
  if (!topics.length) {
    const stage = (citationDocs || []).find((d) => d?.stage)?.stage;
    if (stage && FOLLOWUP_POOLS[stage]) topics.push(stage);
  }
  if (!topics.length) topics.push("default");

  const placementCovered =
    /双机位.*(摆|放|要求)|摆放要求|第一机位|第二机位.*(拍|位置)/.test(corpus);
  const orderedTopics = topics.filter((t) => !(t === "dual_camera" && placementCovered));
  if (placementCovered && !orderedTopics.includes("exam")) orderedTopics.push("exam");
  if (!orderedTopics.length) orderedTopics.push("default");

  const pool = [];
  for (const t of orderedTopics) {
    for (const item of FOLLOWUP_POOLS[t] || []) pool.push(item);
  }
  for (const item of FOLLOWUP_POOLS.default) pool.push(item);

  const out = [];
  const seen = new Set();
  for (const item of pool) {
    const text = typeof item === "string" ? item : item.text;
    const key = normalizeSuggestKey(text);
    if (!key || seen.has(key) || isSuggestionCovered(item, askedKeys, corpus)) continue;
    seen.add(key);
    out.push(text);
    if (out.length >= 3) break;
  }
  return out;
}
