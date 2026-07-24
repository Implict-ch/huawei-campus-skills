import { useState, useEffect } from "react";
import { Link, useParams, useLocation, useSearchParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import FadeIn from "../components/FadeIn.jsx";
import { Icon } from "../icons/index.jsx";
import GroupedTags from "../components/GroupedTags.jsx";
import { ROLE_CARDS } from "../data/hw-app.js";

function formatDate(dateStr) {
  if (!dateStr) return "日期未知";
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// 面经 Markdown 正文中通常重复包含标题、作者、来源等元信息，
// 页面顶部已经单独展示，所以渲染前过滤掉，避免重复和排版杂乱。
function cleanContent(content) {
  if (!content) return "";
  return content
    .trim()
    .replace(/^#\s+[^\n]+\n*/, "")
    .trim()
    .replace(/^(?:\s*[-*]\s+(?:作者|来源)[^\n]*\n*)+/, "")
    .trim();
}

export default function ExperienceDetailPage() {
  const { role, id } = useParams();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  // state 或 URL ?from=agent 任一命中即可（后者更稳，不怕刷新/外链）
  const fromAgent = location.state?.from === "agent" || searchParams.get("from") === "agent";
  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const roleMeta = ROLE_CARDS.find((r) => r.role === role) || ROLE_CARDS[3];

  useEffect(() => {
    fetch(`/api/experiences/${encodeURIComponent(id)}`)
      .then((r) => {
        if (!r.ok) throw new Error("面经加载失败");
        return r.json();
      })
      .then((data) => setDoc(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  return (
    <div className="hw-page">
      <section className="section">
        <div className="container container--narrow">
          <FadeIn>
            {fromAgent ? (
              <Link to="/agent" className="hw-back-link">
                <Icon name="arrow-left" size={14} color="var(--text-muted)" />
                返回智能问答/简历模拟面试
              </Link>
            ) : (
              <Link to={`/experiences/${role}`} className="hw-back-link">
                <Icon name="arrow-left" size={14} color="var(--text-muted)" />
                返回 {roleMeta.title} 列表
              </Link>
            )}
          </FadeIn>

          {loading && <div className="hw-loading">加载中...</div>}
          {error && <div className="hw-error">{error}</div>}

          {doc && (
            <FadeIn>
              <article className="experience-detail">
                <div className="experience-detail__head">
                  <h1 className="experience-detail__title">{doc.title}</h1>
                  {doc.sourceUrl ? (
                    <a
                      href={doc.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="experience-detail__source-link"
                    >
                      查看原始来源 <Icon name="external-link" size={14} color="var(--accent)" />
                    </a>
                  ) : null}
                </div>

                <GroupedTags
                  tags={doc.tags || []}
                  role={role}
                  maxTags={12}
                  className="experience-detail__tags"
                />

                <div className="experience-detail__meta">
                  <span className="experience-detail__date">{formatDate(doc.publishedAt)}</span>
                  <span className="experience-detail__platform">来源：{doc.platform || "未知"}</span>
                </div>

                <div className="experience-detail__body">
                  <ReactMarkdown>{cleanContent(doc.content)}</ReactMarkdown>
                </div>
              </article>
            </FadeIn>
          )}
        </div>
      </section>
    </div>
  );
}
