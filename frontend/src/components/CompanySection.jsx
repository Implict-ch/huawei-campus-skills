import FadeIn, { FADE_STAGGER } from "./FadeIn.jsx";
import SectionHeader from "./SectionHeader.jsx";
import { Icon } from "../icons/index.jsx";
import { COMPANIES, COMPANY_STATS } from "../data/content.js";

export default function CompanySection() {
  return (
    <section className="section" id="exam">
      <div className="container">
        <FadeIn>
          <SectionHeader title="公司笔试真题" />
        </FadeIn>
        <FadeIn delay={FADE_STAGGER}>
          <div className="company-grid">
            {COMPANIES.map((c) => (
              <a key={c.name} href="#" className="company-card" style={{ "--company-accent": c.accent }}>
                <div className="company-card__logo">{c.name.slice(0, 2)}</div>
                <div className="company-card__name">{c.name}</div>
                {c.count && <div className="company-card__count">{c.count}+ 题</div>}
              </a>
            ))}
          </div>
        </FadeIn>
        <FadeIn delay={FADE_STAGGER * 2}>
          <div className="company-stats">
            {COMPANY_STATS.map((s) => (
              <div key={s.label} className="company-stats__item">
                <div className="company-stats__value" style={{ color: `var(${s.colorVar})` }}>
                  <Icon name={s.icon} size={18} color={`var(${s.colorVar})`} />
                  {s.value}
                </div>
                <div className="company-stats__label">{s.label}</div>
              </div>
            ))}
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
