import FadeIn, { FADE_HERO_STEP } from "./FadeIn.jsx";
import { Icon } from "../icons/index.jsx";
import { STATS } from "../data/content.js";

export default function Hero() {
  return (
    <section className="hero">
      <div className="hero__grid-bg" />
      <div className="hero__glow" />

      <div className="hero__inner">
        <div className="hero__scale">
        <FadeIn>
          <div className="hero__badge">
            <div className="hero__badge-dot" />
            <span className="hero__badge-text">校招 · 笔试 · 面试 · 一站搞定</span>
          </div>
        </FadeIn>

        <FadeIn delay={FADE_HERO_STEP}>
          <h1 className="hero__headline">
            CodeFun<span className="hero__headline-accent">2000</span>
            <span className="hero__headline-sub">求职算法训练平台</span>
          </h1>
        </FadeIn>

        <FadeIn delay={FADE_HERO_STEP * 2}>
          <p className="hero__desc">
            覆盖大厂笔试真题、面试手撕、ACM 模式训练、校招路线图，从刷题到拿 Offer，一个平台全搞定。
          </p>
        </FadeIn>

        <FadeIn delay={FADE_HERO_STEP * 3}>
          <div className="hero__actions">
            <a href="#" className="cta-primary">
              开始使用 <Icon name="arrow" size={16} color="var(--on-accent)" />
            </a>
            <a href="#roadmap" className="cta-secondary">
              浏览产品
            </a>
          </div>
        </FadeIn>

        <FadeIn delay={FADE_HERO_STEP * 4}>
          <div className="hero__stats">
            {STATS.map((s) => (
              <div key={s.label} className="hero__stat">
                <div className="hero__stat-value" style={{ color: `var(${s.colorVar})` }}>
                  <Icon name={s.icon} size={20} color={`var(${s.colorVar})`} />
                  {s.value}
                </div>
                <div className="hero__stat-label">{s.label}</div>
              </div>
            ))}
          </div>
        </FadeIn>
        </div>
      </div>
    </section>
  );
}
