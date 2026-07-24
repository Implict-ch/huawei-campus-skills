import FadeIn, { FADE_HERO_STEP } from "./FadeIn.jsx";
import { Icon } from "../icons/index.jsx";

export default function HomeHero() {
  return (
    <section className="hero hw-hero">
      <div className="hero__grid-bg" />

      <div className="hero__inner">
        <div className="hero__scale">
          <FadeIn>
            <div className="hero__badge">
              <span className="hero__badge-bar" aria-hidden="true" />
              <span className="hero__badge-text">华为校招 · 一站式求职助手</span>
            </div>
          </FadeIn>

          <FadeIn delay={FADE_HERO_STEP}>
            <h1 className="hero__headline">
              校招<span className="hero__headline-accent">情报站</span>
              <span className="hero__headline-sub">面经 + 求职教练</span>
            </h1>
          </FadeIn>

          <FadeIn delay={FADE_HERO_STEP * 2}>
            <p className="hero__desc">
              聚合华为校招真实面经，按岗位、时间、语义标签精准分类；
              同时提供华为校招求职教练，解答流程与技术疑难杂症，并基于简历模拟面试。
            </p>
          </FadeIn>

          <FadeIn delay={FADE_HERO_STEP * 3}>
            <div className="hero__actions">
              <a href="#modules" className="cta-primary">
                探索能力 <Icon name="arrow" size={16} color="var(--on-accent)" />
              </a>
            </div>
          </FadeIn>
        </div>
      </div>
    </section>
  );
}
