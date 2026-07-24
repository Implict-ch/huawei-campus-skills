import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";
import SectionHeader from "../components/SectionHeader.jsx";
import ExperienceCard from "../components/ExperienceCard.jsx";
import ExperienceEmptyCard from "../components/ExperienceEmptyCard.jsx";
import KeywordFilter from "../components/KeywordFilter.jsx";
import FadeIn from "../components/FadeIn.jsx";
import { ROLE_CARDS } from "../data/hw-app.js";

const STORAGE_PREFIX = "hw_experience_keywords_";

function storageKey(role) {
  return `${STORAGE_PREFIX}${role}`;
}

function getSavedKeywords(role) {
  if (typeof window === "undefined") return null;
  try {
    const saved = localStorage.getItem(storageKey(role));
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  // 兼容旧 sessionStorage
  try {
    const legacy = sessionStorage.getItem(`experience_keywords_${role}`);
    if (legacy) {
      const parsed = JSON.parse(legacy);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return null;
}

function persistKeywords(role, keywords) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(storageKey(role), JSON.stringify(keywords));
  } catch {}
}

export default function ExperienceListPage() {
  const { role } = useParams();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [keywords, setKeywords] = useState([]);
  const [selectedKeywords, setSelectedKeywords] = useState([]);
  const [keywordsReady, setKeywordsReady] = useState(false);
  const initializedRole = useRef("");
  const roleMeta = ROLE_CARDS.find((r) => r.role === role) || { title: "其他", role: "general" };

  const updateKeywords = useCallback(
    (next) => {
      setSelectedKeywords(next);
      persistKeywords(role, next);
    },
    [role],
  );

  useEffect(() => {
    setLoading(true);
    setKeywordsReady(false);
    initializedRole.current = "";

    fetch(`/api/experiences/role/${role}/keywords`)
      .then((r) => r.json())
      .then((kwData) => {
        const kws = kwData.keywords || [];
        setKeywords(kws);
        const all = kws.map((k) => k.keyword);
        const periodSet = new Set(["实习", "校招"]);
        const saved = getSavedKeywords(role);
        if (Array.isArray(saved) && saved.length > 0) {
          const valid = saved.filter((k) => all.includes(k));
          const nonPeriodAll = all.filter((k) => !periodSet.has(k));
          // 旧缓存若已覆盖全部非时期词，视为曾全选 → 补上新的时期标签
          const wasFullSelect =
            nonPeriodAll.length > 0 &&
            nonPeriodAll.every((k) => valid.includes(k));
          const next = wasFullSelect ? all : valid.length > 0 ? valid : all;
          setSelectedKeywords(next);
          persistKeywords(role, next);
        } else if (Array.isArray(saved) && saved.length === 0) {
          // 用户明确全不选过，尊重空选
          setSelectedKeywords([]);
        } else {
          setSelectedKeywords(all);
          if (all.length > 0) persistKeywords(role, all);
        }
        initializedRole.current = role;
      })
      .catch(() => {
        setKeywords([]);
        setSelectedKeywords([]);
      })
      .finally(() => {
        setKeywordsReady(true);
        setLoading(false);
      });
  }, [role]);

  // 词表变更时，剔除失效关键词；若剔除后为空且非用户空选意图，回退全选
  useEffect(() => {
    if (!keywordsReady || !keywords.length || initializedRole.current !== role) return;
    const all = keywords.map((k) => k.keyword);
    const valid = selectedKeywords.filter((k) => all.includes(k));
    if (valid.length !== selectedKeywords.length) {
      if (valid.length === 0 && selectedKeywords.length > 0) {
        updateKeywords(all);
      } else {
        updateKeywords(valid);
      }
    }
  }, [keywords, keywordsReady, role]);

  useEffect(() => {
    if (!keywordsReady) return;

    if (selectedKeywords.length === 0) {
      setItems([]);
      return;
    }

    const allSelected =
      keywords.length > 0 && selectedKeywords.length === keywords.length;

    const req = allSelected
      ? fetch(`/api/experiences/role/${role}`)
      : fetch(
          `/api/experiences/role/${role}?${new URLSearchParams({
            keywords: selectedKeywords.join(","),
          }).toString()}`,
        );

    req
      .then((r) => r.json())
      .then((data) => setItems(data.items || []))
      .catch(() => setItems([]));
  }, [selectedKeywords, role, keywordsReady, keywords.length]);

  const sortedItems = useMemo(() => {
    const list = [...items];
    list.sort((a, b) => {
      const dateA = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
      const dateB = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
      return dateB - dateA;
    });
    return list;
  }, [items]);

  const noSelection = keywordsReady && selectedKeywords.length === 0;
  const resultCount = noSelection
    ? "请选择关键词"
    : loading
      ? null
      : `${items.length} 篇面经`;

  return (
    <div className="hw-page hw-page--experiences">
      <section className="section">
        <div className="container">
          <FadeIn>
            <SectionHeader title={`${roleMeta.title} 面经`} />
          </FadeIn>

          <div className="experience-list-layout">
            <div className="experience-list-main">
              {loading ? (
                <div className="hw-loading">加载中...</div>
              ) : noSelection ? (
                <div className="experience-list">
                  <ExperienceEmptyCard />
                </div>
              ) : sortedItems.length === 0 ? (
                <div className="hw-empty">没有匹配当前关键词的面经</div>
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
                role={role}
                resultCount={resultCount}
              />
            </aside>
          </div>
        </div>
      </section>
    </div>
  );
}
