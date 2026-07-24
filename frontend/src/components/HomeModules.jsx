import { useState, useEffect } from "react";
import { Icon } from "../icons/index.jsx";

const ROLE_LINKS = {
  ai: "AI大类",
  "software-development": "通软",
  embedded: "嵌入式软件",
  "network-communication": "通信/网络",
  "test-qa": "测试",
};

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
        <div className="home-modules__grid">
          <article className="home-mod home-mod--coach">
            <div className="home-mod__accent" aria-hidden="true" />
            <div className="home-mod__body">
              <div className="home-mod__heading">
                <h2 className="home-mod__title">华为校招求职教练</h2>
                <span className="home-mod__eyebrow">AI 问答</span>
              </div>
              <p className="home-mod__desc">
                输入华为校招相关问题，AI 在知识库中检索面经、政策和流程说明，并给出带证据的回答。
              </p>

              <div className="chat-window" aria-label="示例对话窗口">
                <div className="chat-window__titlebar">
                  <div className="chat-window__traffic" aria-hidden="true">
                    <span />
                    <span />
                    <span />
                  </div>
                  <div className="chat-window__title">求职教练 · 示例会话</div>
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
                  <div className="chat-msg chat-msg--user chat-msg--secondary">
                    <div className="chat-msg__bubble">机考通过线大概多少？</div>
                  </div>
                  <div className="chat-msg chat-msg--assistant chat-msg--secondary">
                    <div className="chat-msg__avatar" aria-hidden="true">
                      AI
                    </div>
                    <div className="chat-msg__col">
                      <div className="chat-msg__bubble">
                        常见 <strong>150+150+300</strong>，通过线多参考 <strong>200 分</strong>
                        （以政策卡片为准）。
                      </div>
                    </div>
                  </div>
                </div>
                <div className="chat-window__composer" aria-hidden="true">
                  <span className="chat-window__composer-placeholder">继续追问机考、测评、面试…</span>
                  <span className="chat-window__composer-send">发送</span>
                </div>
              </div>

              <div className="home-mod__footer">
                <a href="/agent" className="cta-primary home-mod__cta">
                  立即提问 <Icon name="arrow" size={14} color="var(--on-accent)" />
                </a>
              </div>
            </div>
          </article>

          <div className="home-modules__side">
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
