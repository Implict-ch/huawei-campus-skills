import { useState, useEffect } from "react";
import { Navigate, useParams } from "react-router-dom";
import FadeIn from "../components/FadeIn.jsx";
import { Icon } from "../icons/index.jsx";

/** 旧中文 / Hot100 chapter slug -> 当前英文 slug（兼容书签/外链） */
const SLUG_ALIASES = {
  大模型岗: "llm",
  机器学习: "ml",
  深度学习: "dl",
  数组: "array",
  普通数组: "array",
  链表: "linked-list",
  二叉树: "binary-tree",
  "BFS / DFS": "bfs-dfs",
  二分查找: "binary-search",
  排序: "sorting",
  字符串: "string",
  子串: "sliding-window",
  "栈 / 队列": "stack-queue",
  栈: "stack-queue",
  堆: "heap",
  动态规划: "dp",
  多堆动态规划: "dp",
  回溯: "backtracking",
  贪心: "greedy",
  贪心算法: "greedy",
  滑动窗口: "sliding-window",
  双指针: "two-pointers",
  哈希: "hash",
  并查集: "union-find",
  图论: "graph",
  数学: "math",
  矩阵: "array",
  位运算: "bit",
  设计: "design",
  技巧: "array",
  入门教程必刷: "array",
  其他: "other",
  分治: "divide-conquer",
  "原创 / 变种": "original",
  原创: "original",
  变种: "original",
};

/** 变种/原创统一标「原创」，其余标「力扣」 */
function kindBadge(kind) {
  if (kind === "variant" || kind === "original") {
    return { label: "原创", tone: "original" };
  }
  return { label: "力扣", tone: "leetcode" };
}

export default function HandTearCategoryPage() {
  const { category } = useParams();
  const [data, setData] = useState({ categories: [], problems: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/hand-tear")
      .then((r) => {
        if (!r.ok) throw new Error("手撕题库加载失败");
        return r.json();
      })
      .then((d) => setData(d))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  // 中文旧路由重定向到英文 slug
  if (category && SLUG_ALIASES[category]) {
    return <Navigate to={`/hand-tear/${SLUG_ALIASES[category]}`} replace />;
  }

  const catMeta =
    data.categories.find((c) => c.slug === category) ||
    data.categories.find((c) => c.name === category);
  const catName = catMeta?.name || "";
  const problems = data.problems.filter((p) => {
    if (!catName) return false;
    // 「原创 / 变种」聚合所有非力扣题（含已归入算法类的）
    if (catName === "原创 / 变种") {
      return p.kind === "original" || p.kind === "variant";
    }
    return p.category === catName;
  });
  const title = catName || category || "";

  return (
    <div className="hw-page hw-page--hand-tear-category">
      <section className="section">
        <div className="container container--narrow">
          <FadeIn>
            <a href="/hand-tear" className="hw-back-link">
              <Icon name="arrow-left" size={14} color="var(--text-muted)" />
              返回分类
            </a>
          </FadeIn>

          {loading && <div className="hw-loading">加载中...</div>}
          {error && <div className="hw-error">{error}</div>}

          {!loading && !error && (
            <FadeIn>
              <header className="hand-tear-category-header">
                <div className="hand-tear-category-header__title-row">
                  <h1 className="hand-tear-category-header__title">{title}</h1>
                  <span className="hand-tear-category-header__count">{problems.length} 道题</span>
                </div>
                <div className="hand-tear-category-header__divider" aria-hidden="true" />
              </header>

              <div className="experience-detail__body hand-tear-category-body">
                {problems.map((p) => {
                  const primaryUrl = p.codefun_url || p.leetcode_url;
                  const hasBoth = p.codefun_url && p.leetcode_url;
                  const badge = kindBadge(p.kind);
                  const firstSource = p.sources?.[0];
                  const sourceUrl = firstSource
                    ? `/experiences/${firstSource.role}/${firstSource.id}`
                    : "";
                  const cardKey = `${p.title}-${p.leetcode_url || p.prompt || ""}-${firstSource?.id || ""}`;
                  return (
                    <div key={cardKey} className="hand-tear-problem-card">
                      <span
                        className={`hand-tear-problem-card__badge hand-tear-problem-card__badge--${badge.tone}`}
                      >
                        {badge.label}
                      </span>
                      <div className="hand-tear-problem-card__head">
                        <h3 className="hand-tear-problem-card__title">
                          {primaryUrl ? (
                            <a href={primaryUrl} target="_blank" rel="noreferrer">
                              {p.title}
                            </a>
                          ) : sourceUrl ? (
                            <a href={sourceUrl}>{p.title}</a>
                          ) : (
                            p.title
                          )}
                        </h3>
                      </div>
                      {hasBoth && (
                        <div className="hand-tear-problem-card__alt">
                          <a href={p.leetcode_url} target="_blank" rel="noreferrer">
                            LeetCode 链接
                          </a>
                        </div>
                      )}
                      {p.prompt && (
                        <blockquote className="hand-tear-problem-card__prompt">
                          <span className="hand-tear-problem-card__prompt-label">面经原述</span>
                          {p.prompt}
                        </blockquote>
                      )}
                      {p.related_leetcode_url && (
                        <div className="hand-tear-problem-card__alt">
                          可参考：{" "}
                          <a href={p.related_leetcode_url} target="_blank" rel="noreferrer">
                            近似力扣题
                          </a>
                        </div>
                      )}
                      {p.summary && (
                        <p className="hand-tear-problem__summary">{p.summary}</p>
                      )}
                      {p.sources && p.sources.length > 0 && (
                        <div className="hand-tear-problem-card__sources">
                          来源面经：
                          {p.sources.map((s, i) => (
                            <span key={s.id}>
                              <a href={`/experiences/${s.role}/${s.id}`}>{s.title}</a>
                              {i < p.sources.length - 1 ? "、" : ""}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </FadeIn>
          )}
        </div>
      </section>
    </div>
  );
}
