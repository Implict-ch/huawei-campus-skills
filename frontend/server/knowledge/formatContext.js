import fs from "node:fs";
import path from "node:path";
import { ROOT } from "../config.js";
import { knowledgeDocs } from "./store.js";

export function normalizeKnowledgeAssetMarkdown(content) {
  return String(content || "")
    .replace(/!\[([^\]]*)\]\(\s*\.?\/?assets\/([^)\s]+)\s*\)/g, "![$1](/knowledge-assets/$2)")
    .replace(/!\[([^\]]*)\]\(\s*knowledge\/assets\/([^)\s]+)\s*\)/g, "![$1](/knowledge-assets/$2)");
}

export function isExamTrackQuestion(q) {
  return /会考什么|考什么|AI\s*机考|非\s*AI|怎么准备机考|机考.*(准备|备考|题型|类型|方向)|岗位.*(AI|机考)/i.test(
    String(q || "")
  );
}

export function isTargetUniversityQuestion(q) {
  const s = String(q || "");
  return /目标院校|院校清单|是不是目标|算不算目标|非目标院校|(985|211).{0,12}(目标|院校|清单)|(目标|院校).{0,12}(985|211)/.test(
    s
  );
}

export function ensureExamTrackCard(docs) {
  const list = Array.isArray(docs) ? [...docs] : [];
  const card = knowledgeDocs.find(
    (d) => d.id === "hw-exam-ai-vs-nonai" || d.path.includes("exam-ai-vs-nonai")
  );
  if (!card) return list;
  if (list.some((d) => d.id === card.id || d.path === card.path)) return list;
  return [card, ...list].slice(0, 14);
}

export function ensureTargetUniversityCard(docs) {
  const list = Array.isArray(docs) ? [...docs] : [];
  const card = knowledgeDocs.find(
    (d) => d.id === "hw-codenote-p0102" || /\/P0102\.md$/i.test(d.path || "")
  );
  if (!card) return list;
  const rest = list.filter((d) => d.id !== card.id && d.path !== card.path);
  return [card, ...rest].slice(0, 14);
}

export function formatVideoTimestampHint(docs) {
  const videos = (docs || []).filter(
    (d) => d && (d.path.includes("knowledge/videos/segments/") || d.platform === "bilibili") && d.timeRange
  );
  if (videos.length === 0) return "";
  const lines = videos.slice(0, 6).map((d) => {
    const ep = d.episodeTitle || d.sourceTitle || d.title || "公开课";
    const url = d.sourceUrl || "";
    return `- 《${ep}》时间段 ${d.timeRange}${url ? ` | ${url}` : ""}`;
  });
  return [
    "",
    "【公开课时间戳强制清单】若本次回答用到了下列任一切片，必须在正文末尾输出「## 公开课时间戳」，并把时间改写成「第 X 分 Y 秒 – 第 A 分 B 秒」+ 链接；未用到的不要列。",
    ...lines,
  ].join("\n");
}

export function formatRetrieved(docs) {
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
      if (d.path.includes("knowledge/videos/segments/") || d.platform === "bilibili") {
        const ep = d.episodeTitle || d.sourceTitle || d.title || "";
        if (ep) sourceLine += ` | 公开课课名：${ep}`;
        if (d.timeRange) sourceLine += ` | 时间段：${d.timeRange}`;
        sourceLine +=
          " | 【若引用本条：必须在回答末尾「公开课时间戳」列出课名 + 起止时间 + 链接，禁止编造时间】";
      }
      let contentPreview = d.content.length < 1500
        ? d.content
        : d.content.slice(0, 1200) + "...";
      contentPreview = normalizeKnowledgeAssetMarkdown(contentPreview);

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

export function toRetrievedMeta(docs) {
  return (docs || [])
    .filter((d) => d && (d.title || d.sourceUrl))
    .map((d) => ({ id: d.id, title: d.title, sourceUrl: d.sourceUrl }));
}
