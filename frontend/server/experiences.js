import fs from "node:fs";
import path from "node:path";
import {
  ROOT,
  EXPERIENCES_PUBLIC,
  KEYWORDS_FILE,
  SEMANTIC_TAGS_FILE,
} from "./config.js";
import { knowledgeDocs } from "./knowledge/store.js";

export const TAG_BLOCKLIST = new Set([
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

export const experienceKeywords = {};
try {
  Object.assign(experienceKeywords, JSON.parse(fs.readFileSync(KEYWORDS_FILE, "utf-8")));
} catch (err) {
  console.warn("[keywords] failed to load", err.message);
}

export const experienceSemanticTags = {};
try {
  const parsed = JSON.parse(fs.readFileSync(SEMANTIC_TAGS_FILE, "utf-8"));
  Object.assign(experienceSemanticTags, parsed.docs || parsed);
  console.log(
    `[keywords] loaded semantic tags for ${Object.keys(experienceSemanticTags).length} docs (${parsed.method || "unknown"})`,
  );
} catch (err) {
  console.warn("[keywords] semantic tags not loaded, fallback to lexical filter:", err.message);
}

export function resolveExperienceDisplayTags(id, frontmatterTags) {
  const tagged = experienceSemanticTags[id];
  if (tagged && Array.isArray(tagged.labels)) {
    return tagged.labels.filter((t) => t && !TAG_BLOCKLIST.has(String(t)));
  }
  return (Array.isArray(frontmatterTags) ? frontmatterTags : []).filter(
    (t) => t && !TAG_BLOCKLIST.has(String(t)),
  );
}

const PERIOD_KEYWORDS = new Set(["实习", "校招"]);
const CAMPUS_TITLE_RE = /秋招|春招|校招|应届生|应届|校园招聘|(?:2[0-9])届|(?:20(?:2[0-9]|1[0-9]))届/i;
const INTERN_TITLE_RE = /暑期实习|寒假实习|日常实习|实习生|实习岗|实习面|实习offer/i;

function getExperienceLabels(item) {
  const tagged = experienceSemanticTags[item.id];
  if (tagged && Array.isArray(tagged.labels) && tagged.labels.length > 0) {
    return tagged.labels.map((l) => String(l));
  }
  return Array.isArray(item.tags) ? item.tags.map((l) => String(l)) : [];
}

function resolvePeriodLabel(item, labels) {
  const title = item.title || "";
  if (CAMPUS_TITLE_RE.test(title) && !INTERN_TITLE_RE.test(title)) return "校招";
  if (INTERN_TITLE_RE.test(title) && !CAMPUS_TITLE_RE.test(title)) return "实习";
  if (CAMPUS_TITLE_RE.test(title) && INTERN_TITLE_RE.test(title)) return "校招";
  if (labels.includes("校招")) return "校招";
  if (labels.includes("实习")) return "实习";
  return "校招";
}

export function registerExperiencesRoutes(app) {
  app.get("/api/experiences", (req, res) => {
    try {
      const data = JSON.parse(fs.readFileSync(EXPERIENCES_PUBLIC, "utf-8"));
      res.json(data);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/experiences/role/:role/keywords", (req, res) => {
    try {
      let list = experienceKeywords[req.params.role] || [];
      try {
        const fresh = JSON.parse(fs.readFileSync(KEYWORDS_FILE, "utf-8"));
        Object.assign(experienceKeywords, fresh);
        list = fresh[req.params.role] || [];
      } catch {
        /* 沿用启动时缓存 */
      }
      res.json({
        keywords: list,
        method: Object.keys(experienceSemanticTags).length ? "llm_semantic" : "lexical",
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/experiences/role/:role", (req, res) => {
    try {
      const data = JSON.parse(fs.readFileSync(EXPERIENCES_PUBLIC, "utf-8"));
      const role = req.params.role;
      let items = data.grouped?.[role] || [];

      const keywordsParam = req.query.keywords;
      if (keywordsParam) {
        const selected = keywordsParam.split(",").map((k) => k.trim()).filter(Boolean);
        const selectedPeriod = selected.filter((k) => PERIOD_KEYWORDS.has(k));
        const selectedOther = selected.filter((k) => !PERIOD_KEYWORDS.has(k));
        const selectedOtherLower = selectedOther.map((k) => k.toLowerCase());

        const roleKeywords = experienceKeywords[role] || [];
        const allOtherKeywords = roleKeywords
          .map((e) => e.keyword)
          .filter((k) => !PERIOD_KEYWORDS.has(k));
        const otherUnconstrained =
          selectedOther.length === 0 ||
          (allOtherKeywords.length > 0 &&
            allOtherKeywords.every((k) => selected.includes(k)));

        const aliasMap = new Map();
        for (const entry of roleKeywords) {
          if (PERIOD_KEYWORDS.has(entry.keyword)) continue;
          aliasMap.set(entry.keyword.toLowerCase(), (entry.aliases || []).map((a) => a.toLowerCase()));
        }
        const otherAliases = selectedOtherLower.flatMap((k) => aliasMap.get(k) || [k]);
        const useSemantic = Object.keys(experienceSemanticTags).length > 0;

        items = items.filter((item) => {
          const labels = getExperienceLabels(item);
          const period = resolvePeriodLabel(item, labels);
          const title = item.title || "";

          if (selectedPeriod.length === 1) {
            const want = selectedPeriod[0];
            if (want === "实习") {
              if (CAMPUS_TITLE_RE.test(title)) return false;
              if (period !== "实习") return false;
            } else {
              if (INTERN_TITLE_RE.test(title) && !CAMPUS_TITLE_RE.test(title)) return false;
              if (period !== "校招") return false;
            }
          } else if (selectedPeriod.length === 0 && selectedOther.length === 0) {
            return false;
          }

          if (otherUnconstrained) return true;

          if (useSemantic && labels.length > 0) {
            const labelSet = new Set(labels.map((l) => l.toLowerCase()));
            return selectedOtherLower.some((k) => labelSet.has(k));
          }
          const doc = knowledgeDocs.find((d) => d.id === item.id);
          const text = doc ? `${doc.title || ""} ${doc.searchText || ""}` : `${title}`;
          const textLower = text.toLowerCase();
          return otherAliases.some((alias) => textLower.includes(alias));
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
}
