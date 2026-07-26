import { knowledgeDocs } from "./store.js";

export function tokenizeForBm25(text) {
  return text
    .toLowerCase()
    .replace(/[^\u4e00-\u9fa5a-z0-9]+/g, " ")
    .split(" ")
    .filter((t) => t.length > 1 || /[\u4e00-\u9fa5]/.test(t));
}

export function computeBm25Stats() {
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

export function bm25Score(doc, qTokens, stats) {
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
