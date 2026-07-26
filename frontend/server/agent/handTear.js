import fs from "node:fs";
import { HAND_TEAR_DATA } from "../config.js";

export function isAiAlgorithmQuestion(question) {
  const q = question.toLowerCase();
  const keywords = [
    "算法", "ai", "人工智能", "机器学习", "深度学习", "大模型", "llm", "nlp", "cv",
    "computer vision", "自然语言处理", "推荐算法", "图像算法", "视觉算法", "神经网络",
    " transformer", "pytorch", "tensorflow", "grpo", "ppo", "k-means", "adamw", "fm",
  ];
  return keywords.some((k) => q.includes(k));
}

export function loadAiHandTearSamples() {
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
