import { useState, useEffect, useMemo, useCallback } from "react";
import { useParams, useLocation } from "react-router-dom";
import SectionHeader from "../components/SectionHeader.jsx";
import ExperienceCard from "../components/ExperienceCard.jsx";
import KeywordFilter from "../components/KeywordFilter.jsx";
import FadeIn from "../components/FadeIn.jsx";
import { ROLE_CARDS } from "../data/hw-app.js";

function getSavedKeywords(role) {
  if (typeof window === "undefined") return null;
  try {
    const state = window.history.state;
    if (state && Array.isArray(state.keywords)) {
      return state.keywords;
    }
  } catch {}
  try {
    const saved = sessionStorage.getItem(`experience_keywords_${role}`);
    if (saved) return JSON.parse(saved);
  } catch {}
  return null;
}

function persistKeywords(role, keywords) {
  if (typeof window === "undefined") return;
  try {
    window.history.replaceState({ keywords }, "");
  } catch {}
  try {
    sessionStorage.setItem(`experience_keywords_${role}`, JSON.stringify(keywords));
  } catch {}
}

export default function ExperienceListPage() {
  const { role } = useParams();
  const location = useLocation();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [keywords, setKeywords] = useState([]);
  const [selectedKeywords, setSelectedKeywords] = useState(() => {
    const saved = getSavedKeywords(role);
    return saved || [];
  });
  const [filterLoading, setFilterLoading] = useState(false);
  const roleMeta = ROLE_CARDS.find((r) => r.role === role) || { title: "其他", role: "general" };

  const updateKeywords = useCallback((next) => {
    setSelectedKeywords(next);
    persistKeywords(role, next);
  }, [role]);

  useEffect(() => {
    setLoading(true);
    setFilterLoading(false);
    Promise.all([
      fetch("/api/experiences").then((r) => r.json()),
      fetch(`/api/experiences/role/${role}/keywords`).then((r) => r.json()),
    ])
      .then(([data, kwData]) => {
        const list = data.grouped?.[role] || [];
        setItems(list);
        const kws = kwData.keywords || [];
        setKeywords(kws);
      })
      .catch(() => {
        setItems([]);
        setKeywords([]);
      })
      .finally(() => setLoading(false));
  }, [role]);

  useEffect(() => {
    if (keywords.length === 0) return;
    const valid = selectedKeywords.filter((k) => keywords.some((kw) => kw.keyword === k));
    if (valid.length !== selectedKeywords.length) {
      updateKeywords(valid);
    }
    if (valid.length === 0) {
      const all = keywords.map((k) => k.keyword);
      updateKeywords(all);
    }
  }, [keywords]);

  useEffect(() => {
    if (keywords.length === 0) return;
    const allSelected = selectedKeywords.length === keywords.length;
    if (selectedKeywords.length === 0 || allSelected) {
      fetch(`/api/experiences/role/${role}`)
        .then((r) => r.json())
        .then((data) => setItems(data.items || []))
        .catch(() => setItems([]));
      return;
    }
    setFilterLoading(true);
    const params = new URLSearchParams();
    params.set("keywords", selectedKeywords.join(","));
      fetch(`/api/experiences/role/${role}?${params.toString()}`)
      .then((r) => r.json())
      .then((data) => setItems(data.items || []))
      .catch(() => setItems([]))
      .finally(() => setFilterLoading(false));
  }, [selectedKeywords, role, keywords.length]);

  const sortedItems = useMemo(() => {
    const list = [...items];
    list.sort((a, b) => {
      const dateA = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
      const dateB = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
      return dateB - dateA;
    });
    return list;
  }, [items]);

  const desc = `共 ${items.length} 篇，按发布时间倒序排列`;

  return (
    <div className="hw-page">
      <section className="section">
        <div className="container">
          <FadeIn>
            <SectionHeader
              label={`// ${roleMeta.title}`}
              title={`${roleMeta.title} 面经`}
              desc={desc}
            />
          </FadeIn>

          <div className="experience-list-layout">
            <div className="experience-list-main">
              {loading ? (
                <div className="hw-loading">加载中...</div>
              ) : sortedItems.length === 0 ? (
                <div className="hw-empty">该分类下暂无面经</div>
              ) : (
                <div className="experience-list">
                  {sortedItems.map((exp, i) => (
                    <ExperienceCard key={exp.id} exp={{ ...exp, role }} index={i} />
                  ))}
                </div>
              )}
            </div>

            <aside className="experience-list-sidebar">
              <KeywordFilter
                keywords={keywords}
                selected={selectedKeywords}
                onChange={updateKeywords}
              />
              {filterLoading && (
                <div className="keyword-filter__loading">筛选中...</div>
              )}
            </aside>
          </div>
        </div>
      </section>
    </div>
  );
}
