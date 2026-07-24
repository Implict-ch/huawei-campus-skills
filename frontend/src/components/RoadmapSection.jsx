import { useState } from "react";
import FadeIn, { FADE_STAGGER } from "./FadeIn.jsx";
import SectionHeader from "./SectionHeader.jsx";
import { Icon, IconBox } from "../icons/index.jsx";
import { ROADMAP_STEPS, ROADMAP_UPCOMING } from "../data/content.js";

export default function RoadmapSection() {
  const [active, setActive] = useState(null);

  return (
    <section className="section" id="roadmap">
      <div className="container">
        <FadeIn>
          <SectionHeader
            label="// ROADMAP"
            title="校招路线图"
            desc="从投递到入职，每一步都帮你规划清楚"
          />
        </FadeIn>
        <FadeIn delay={FADE_STAGGER}>
          <div className="roadmap-panel">
            <div className="roadmap-panel__bar" />
            <div className="roadmap-panel__head">
              <IconBox icon="building" color="#E33" size={52} />
              <div className="roadmap-panel__head-text">
                <h3 className="roadmap-panel__title">华为校招求职路线图</h3>
                <p className="roadmap-panel__subtitle">覆盖全流程 · 每步详细拆解 · 持续更新</p>
              </div>
              <a href="#" className="cta-primary cta-primary--sm roadmap-panel__cta">
                查看完整路线图 <Icon name="arrow" size={14} color="var(--on-accent)" />
              </a>
            </div>
            <div className="roadmap-steps">
              <div className="roadmap-steps__track" />
              <div className="roadmap-steps__list">
                {ROADMAP_STEPS.map((s, i) => {
                  const isActive = active === i;
                  return (
                    <button
                      key={s.step}
                      type="button"
                      className={`roadmap-step${isActive ? " roadmap-step--active" : ""}`}
                      style={{ "--step-color": s.color }}
                      onClick={() => setActive(isActive ? null : i)}
                    >
                      <div className="roadmap-step__icon">
                        <Icon name={s.icon} size={22} color={isActive ? s.color : "var(--text-secondary)"} />
                      </div>
                      <div className="roadmap-step__name">{s.step}</div>
                      <div className={`roadmap-step__desc${isActive ? " roadmap-step__desc--open" : ""}`}>
                        {s.desc}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
            <p className="roadmap-panel__hint">
              <Icon name="search" size={14} color="var(--text-muted)" />
              点击节点查看详情 · 路线图包含每步的学习资料和注意事项
            </p>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
