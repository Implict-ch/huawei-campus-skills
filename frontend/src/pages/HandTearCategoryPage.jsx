import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import FadeIn from "../components/FadeIn.jsx";
import { Icon } from "../icons/index.jsx";

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

  const catMeta = data.categories.find((c) => c.slug === category);
  const problems = data.problems.filter((p) => p.category === (catMeta?.name || ""));

  return (
    <div className="hw-page">
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
              <div className="experience-detail__meta" style={{ marginBottom: 12 }}>
                <span className="experience-detail__platform">{catMeta?.name || category}</span>
                <span className="experience-detail__grade">{problems.length} 道题</span>
              </div>
              <h1 className="experience-detail__title">{catMeta?.name || category}</h1>

                  <div className="experience-detail__body" style={{ marginTop: 24 }}>
                {problems.map((p) => {
                  const primaryUrl = p.codefun_url || p.leetcode_url;
                  const hasBoth = p.codefun_url && p.leetcode_url;
                  return (
                    <div
                      key={primaryUrl}
                      style={{
                        marginBottom: 24,
                        padding: 20,
                        borderRadius: 12,
                        border: "1px solid var(--border)",
                        background: "var(--surface-card)",
                      }}
                    >
                      <h3 style={{ margin: "0 0 10px", fontSize: 18 }}>
                        <a
                          href={primaryUrl}
                          target="_blank"
                          rel="noreferrer"
                          style={{ color: "var(--accent)", textDecoration: "none" }}
                        >
                          {p.title}
                        </a>
                      </h3>
                      {hasBoth && (
                        <div style={{ fontSize: 13, color: "var(--text-tertiary)", marginBottom: 10 }}>
                          <a
                            href={p.leetcode_url}
                            target="_blank"
                            rel="noreferrer"
                            style={{ color: "var(--text-tertiary)", textDecoration: "underline" }}
                          >
                            LeetCode 链接
                          </a>
                        </div>
                      )}
                      {p.summary && (
                        <p className="hand-tear-problem__summary">{p.summary}</p>
                      )}
                      {p.sources && p.sources.length > 0 && (
                        <div style={{ fontSize: 14, color: "var(--text-secondary)", marginTop: 10 }}>
                          来源面经：
                          {p.sources.map((s, i) => (
                            <span key={s.id}>
                              <a
                                href={`/experiences/${s.role}/${s.id}`}
                                style={{ color: "var(--text-secondary)", textDecoration: "underline" }}
                              >
                                {s.title}
                              </a>
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
