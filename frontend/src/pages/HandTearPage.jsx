import { useState, useEffect } from "react";
import SectionHeader from "../components/SectionHeader.jsx";
import CategoryCard from "../components/CategoryCard.jsx";
import FadeIn from "../components/FadeIn.jsx";
import { Icon } from "../icons/index.jsx";

const GROUP_ORDER = ["算法/AI 岗", "传统工程岗"];
const GROUP_LABELS = {
  "算法/AI 岗": "算法 / AI 岗",
  "传统工程岗": "传统工程岗",
};
const GROUP_DESC = {
  "算法/AI 岗": "面向算法、机器学习、深度学习、大模型岗位的面试手撕题",
  "传统工程岗": "面向通用软件开发、嵌入式、通信、测试等岗位的经典算法手撕题",
};

export default function HandTearPage() {
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

  const grouped = {};
  for (const cat of data.categories) {
    const group = cat.group || "传统工程岗";
    if (!grouped[group]) grouped[group] = [];
    grouped[group].push(cat);
  }

  return (
    <div className="hw-page">
      <section className="section">
        <div className="container">
          <FadeIn>
            <a href="/" className="hw-back-link">
              <Icon name="arrow-left" size={14} color="var(--text-muted)" />
              返回首页
            </a>
          </FadeIn>

          <FadeIn>
            <SectionHeader
              label="// 手撕题"
              title="按岗位分类"
              desc={`共收录 ${data.problems.length} 道手撕题，按目标岗位选择对应题库`}
            />
          </FadeIn>

          {loading && <div className="hw-loading">加载中...</div>}
          {error && <div className="hw-error">{error}</div>}

          {!loading && !error && (
            <div className="hand-tear-groups">
              {GROUP_ORDER.map((group) => {
                const cats = grouped[group];
                if (!cats || cats.length === 0) return null;
                return (
                  <div key={group} className="hand-tear-group">
                    <FadeIn>
                      <div className="hand-tear-group__header">
                        <h2 className="hand-tear-group__title">{GROUP_LABELS[group] || group}</h2>
                        <p className="hand-tear-group__desc">{GROUP_DESC[group]}</p>
                      </div>
                    </FadeIn>
                    <div className="role-grid role-grid--page">
                      {cats.map((cat, i) => (
                        <CategoryCard key={cat.slug} {...cat} index={i} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
