export const knowledgeDocs = [];
export let knowledgeStats = { avgDL: 0, idf: {}, N: 0 };

export function setKnowledgeStats(stats) {
  knowledgeStats = stats;
}
