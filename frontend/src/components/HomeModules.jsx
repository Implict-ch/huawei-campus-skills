import { useState, useEffect } from "react";
import { Icon } from "../icons/index.jsx";

const ROLE_LINKS = {
  ai: "AI大类",
  "software-development": "通软",
  embedded: "嵌入式软件",
  "network-communication": "通信/网络",
  "test-qa": "测试",
};

const EXAM_PRACTICE_URL = "https://codefun2000.com/problemset/hw";

const COACH_POINTS = [
  "机考形式、分值与通过线",
  "各岗位面经节奏与高频追问",
  "手撕考点与复习优先级",
  "根据简历进行一场模拟面试",
];

const QUICK_ASKS = [
  { label: "机考通过线？", q: "华为校招机考通过线大概多少？" },
  { label: "AI 岗几轮面？", q: "华为 AI 岗技术面一般几轮？手撕难吗？" },
  { label: "手撕考什么？", q: "华为技术面手撕一般考什么题？" },
  {
    label: "根据我的简历进行一场模拟面试",
    href: "/agent?mode=resume",
  },
];

export default function HomeModules() {
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
    <section className="section home-modules" id="modules">
      <div className="container">
        <header className="home-modules__hero">
          <h1 className="home-modules__page-title">华为校招求职教练</h1>
        </header>

        <div className="home-modules__stack">
          <article className="home-mod home-mod--coach home-mod--coach-row">
            <div className="home-mod__accent" aria-hidden="true" />
            <div className="home-mod__coach-layout">
              <div className="home-mod__coach-main">
                <div className="home-mod__heading">
                  <h2 className="home-mod__title">求职教练</h2>
                  <span className="home-mod__eyebrow">AI 问答</span>
                </div>
                <p className="home-mod__desc">
                  输入华为校招相关问题，AI 在知识库中检索面经、政策和流程说明，并给出带证据的回答。
                </p>
                <ul className="home-mod__points" aria-label="可咨询范围">
                  {COACH_POINTS.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
                <div className="home-mod__quick">
                  <span className="home-mod__quick-label">试试问</span>
                  <div className="home-mod__quick-list">
                    {QUICK_ASKS.map((item) => (
                      <a
                        key={item.label}
                        href={
                          item.href || `/agent?q=${encodeURIComponent(item.q)}`
                        }
                        className="home-mod__quick-chip"
                      >
                        {item.label}
                      </a>
                    ))}
                  </div>
                </div>
                <div className="home-mod__footer">
                  <a href="/agent" className="cta-primary home-mod__cta">
                    立即提问 <Icon name="arrow" size={14} color="var(--on-accent)" />
                  </a>
                </div>
              </div>

              <div className="home-mod__coach-demo" aria-label="示例对话">
                <div className="chat-window chat-window--hero" aria-label="示例对话窗口">
                  <div className="chat-window__titlebar">
                    <div className="chat-window__traffic" aria-hidden="true">
                      <span />
                      <span />
                      <span />
                    </div>
                    <div className="chat-window__title">示例会话</div>
                    <div className="chat-window__titlebar-spacer" />
                  </div>
                  <div className="chat-window__body">
                    <div className="chat-msg chat-msg--user">
                      <div className="chat-msg__bubble">华为 AI 岗技术面一般几轮？手撕难吗？</div>
                    </div>
                    <div className="chat-msg chat-msg--assistant">
                      <div className="chat-msg__avatar" aria-hidden="true">
                        AI
                      </div>
                      <div className="chat-msg__col">
                        <div className="chat-msg__bubble">
                          多数是 <strong>2–3 轮技术面 + 主管面</strong>
                          。手撕多在 Hot100 中等，项目深挖很常见。
                        </div>
                        <div className="chat-msg__sources">
                          <span className="chat-msg__source">面经 · 技术面</span>
                          <span className="chat-msg__source">手撕 Hot100</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="chat-window__composer" aria-hidden="true">
                    <span className="chat-window__composer-placeholder">继续追问…</span>
                    <span className="chat-window__composer-send">发送</span>
                  </div>
                </div>
              </div>
            </div>
          </article>

          <div className="home-modules__row3">
            <article className="home-mod home-mod--exam">
              <div className="home-mod__accent" aria-hidden="true" />
              <div className="home-mod__body">
                <div className="home-mod__heading">
                  <h3 className="home-mod__title home-mod__title--sm">校招机考真题题库</h3>
                  <span className="home-mod__meta">共 600+ 道编程题</span>
                </div>
                <p className="home-mod__desc">
                  包含 AI/非 AI 方向机考真题（包含 AI 选择题）共 600+ 道并实时更新
                </p>
                <div className="home-mod__footer">
                  <a
                    href={EXAM_PRACTICE_URL}
                    className="cta-secondary home-mod__cta"
                    target="_blank"
                    rel="noreferrer"
                  >
                    在线刷题
                  </a>
                </div>
              </div>
            </article>

            <article className="home-mod home-mod--exp">
              <div className="home-mod__accent" aria-hidden="true" />
              <div className="home-mod__body">
                <div className="home-mod__heading">
                  <h3 className="home-mod__title home-mod__title--sm">面经知识库</h3>
                  <span className="home-mod__meta">共 {totalExperiences} 篇面经</span>
                </div>
                <p className="home-mod__desc">按岗位分类并按时间排序的真实华为校招面经。</p>
                <div className="home-mod__chips">
                  {Object.entries(ROLE_LINKS).map(([role, label]) => (
                    <a key={role} href={`/experiences/${role}`} className="home-mod__chip">
                      {label}
                    </a>
                  ))}
                </div>
                <div className="home-mod__footer">
                  <a href="/experiences" className="cta-secondary home-mod__cta">
                    浏览面经
                  </a>
                </div>
              </div>
            </article>

            <article className="home-mod home-mod--tear">
              <div className="home-mod__accent" aria-hidden="true" />
              <div className="home-mod__body">
                <div className="home-mod__heading">
                  <h3 className="home-mod__title home-mod__title--sm">手撕知识库</h3>
                  <span className="home-mod__meta">67 道题 · 15 个算法分类</span>
                </div>
                <p className="home-mod__desc">
                  汇总真实面经中的技术面试手撕题，按算法考点分类整理。
                </p>
                <div className="home-mod__footer">
                  <a href="/hand-tear" className="cta-secondary home-mod__cta">
                    查看手撕题
                  </a>
                </div>
              </div>
            </article>
          </div>
        </div>
      </div>
    </section>
  );
}
