import { knowledgeDocs } from "../knowledge/store.js";

export function postProcessCodeFunLinks(answer) {
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

  answer = answer.replace(
    /- \[([A-D])\] CodeFun2000\s*面经[：:]\s*([^。\n]+)/g,
    (match, grade, title) => {
      const t = title.trim().replace(/《|》/g, "").trim().replace(/\s+/g, " ");
      const url = urlMap.get(t) || urlMap.get(title.trim());
      return url ? `- [${grade}] [${title.trim()}](${url}) — CodeFun2000` : match;
    }
  );

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
