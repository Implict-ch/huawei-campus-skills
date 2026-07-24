import { useState, useEffect } from "react";
import HomeHero from "../components/HomeHero.jsx";
import { Icon } from "../icons/index.jsx";

const ROLE_LINKS = {
  "software-development": "通用软件开发",
  ai: "AI大类",
  embedded: "嵌入式软件",
  "network-communication": "通信/网络",
  "test-qa": "测试",
};

export default function HomePage() {
  const [counts, setCounts] = useState({});

  useEffect(() => {
    fetch("/api/experiences")
      .then((r) => r.json())
      .then((data) => {
        if (data.grouped) {
          const next = {};
          for (const [role, list] of Object.entries(data.grouped)) {
            next[role] = list.length;
          }
          setCounts(next);
        }
      })
      .catch(() => {});
  }, []);

  const totalExperiences = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <div className="hw-home">
      <HomeHero />

      <section className="section" id="modules">
        <div className="container">
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "2fr 1fr",
              gap: 24,
              alignItems: "stretch",
            }}
          >
            {/* 主模块：华为校招求职教练 */}
            <div
              className="surface-card"
              style={{
                padding: 40,
                borderRadius: 16,
                border: "1px solid var(--border)",
                borderTop: "4px solid #C084FC",
                display: "flex",
                flexDirection: "column",
                gap: 20,
              }}
            >
              <div>
                <span
                  style={{
                    display: "inline-block",
                    padding: "4px 10px",
                    borderRadius: 999,
                    background: "rgba(192, 132, 252, 0.12)",
                    color: "#C084FC",
                    fontSize: 12,
                    fontWeight: 600,
                    marginBottom: 12,
                  }}
                >
                  AI 问答
                </span>
                <h2
                  style={{
                    fontSize: 28,
                    margin: "0 0 12px",
                    color: "var(--text-primary)",
                  }}
                >
                  华为校招求职教练
                </h2>
                <p
                  style={{
                    margin: 0,
                    color: "var(--text-secondary)",
                    lineHeight: 1.6,
                    maxWidth: 520,
                  }}
                >
                  输入华为校招相关问题，AI 在知识库中检索面经、政策和流程说明，并给出带证据的回答。
                </p>
              </div>

              <div
                style={{
                  padding: 18,
                  borderRadius: 12,
                  background: "var(--surface-2)",
                  border: "1px solid var(--border)",
                }}
              >
                <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 10 }}>
                  示例对话
                </div>
                <div
                  style={{
                    padding: 12,
                    borderRadius: 8,
                    background: "var(--surface)",
                    marginBottom: 8,
                    color: "var(--text-primary)",
                    fontSize: 14,
                  }}
                >
                  华为面试一般有几轮？
                </div>
                <div
                  style={{
                    padding: 12,
                    borderRadius: 8,
                    background: "rgba(192, 132, 252, 0.10)",
                    color: "#C084FC",
                    fontSize: 14,
                  }}
                >
                  通常 2-3 轮技术面 + 1 轮主管面，最后是入池/开奖。
                </div>
              </div>

              <div style={{ marginTop: "auto" }}>
                <a href="/agent" className="cta-primary cta-primary--lg">
                  立即提问 <Icon name="arrow" size={16} color="var(--on-accent)" />
                </a>
              </div>
            </div>

            {/* 右侧两个辅助模块 */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 24,
              }}
            >
              {/* 面经知识库 */}
              <div
                className="surface-card"
                style={{
                  flex: 1,
                  padding: 28,
                  borderRadius: 16,
                  border: "1px solid var(--border)",
                  borderTop: "4px solid #58A6FF",
                  display: "flex",
                  flexDirection: "column",
                  gap: 14,
                }}
              >
                <div>
                  <h3
                    style={{
                      fontSize: 20,
                      margin: "0 0 6px",
                      color: "var(--text-primary)",
                    }}
                  >
                    面经知识库
                  </h3>
                  <p
                    style={{
                      margin: 0,
                      fontSize: 14,
                      color: "var(--text-secondary)",
                      lineHeight: 1.5,
                    }}
                  >
                    按岗位分类并按时间排序的真实华为校招面经。
                  </p>
                </div>

                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 8,
                  }}
                >
                  {Object.entries(ROLE_LINKS).map(([role, label]) => (
                    <a
                      key={role}
                      href={`/experiences/${role}`}
                      style={{
                        padding: "6px 10px",
                        borderRadius: 999,
                        background: "var(--surface-2)",
                        color: "var(--text-secondary)",
                        fontSize: 12,
                        textDecoration: "none",
                      }}
                    >
                      {label}
                    </a>
                  ))}
                </div>

                <div style={{ marginTop: "auto", fontSize: 13, color: "var(--text-tertiary)" }}>
                  共 {totalExperiences} 篇面经
                </div>
                <a href="/experiences" className="cta-secondary" style={{ alignSelf: "flex-start" }}>
                  浏览面经
                </a>
              </div>

              {/* 手撕知识库 */}
              <div
                className="surface-card"
                style={{
                  flex: 1,
                  padding: 28,
                  borderRadius: 16,
                  border: "1px solid var(--border)",
                  borderTop: "4px solid #3FB950",
                  display: "flex",
                  flexDirection: "column",
                  gap: 14,
                }}
              >
                <div>
                  <h3
                    style={{
                      fontSize: 20,
                      margin: "0 0 6px",
                      color: "var(--text-primary)",
                    }}
                  >
                    手撕知识库
                  </h3>
                  <p
                    style={{
                      margin: 0,
                      fontSize: 14,
                      color: "var(--text-secondary)",
                      lineHeight: 1.5,
                    }}
                  >
                    汇总真实面经中的技术面试手撕题，按算法考点分类整理。
                  </p>
                </div>

                <div style={{ marginTop: "auto", fontSize: 13, color: "var(--text-tertiary)" }}>
                  67 道题 · 15 个算法分类
                </div>
                <a
                  href="/hand-tear"
                  className="cta-secondary"
                  style={{ alignSelf: "flex-start" }}
                >
                  查看手撕题
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
