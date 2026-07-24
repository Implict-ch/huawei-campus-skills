import FadeIn, { FADE_STAGGER } from "./FadeIn.jsx";
import SectionHeader from "./SectionHeader.jsx";
import { IconBox } from "../icons/index.jsx";
import { PLATFORM_FEATURES } from "../data/content.js";

export default function PlatformSection() {
  return (
    <section className="section" id="platform">
      <div className="container">
        <FadeIn>
          <SectionHeader
            label="// PLATFORM"
            title="平台能力"
            desc="不只是题库，更是一站式求职训练平台"
          />
        </FadeIn>
        <div className="platform-grid">
          {PLATFORM_FEATURES.map((f, i) => (
            <FadeIn key={f.title} delay={i * FADE_STAGGER}>
              <div className="platform-card" style={{ "--card-accent": `var(${f.colorVar})` }}>
                <IconBox icon={f.icon} color={`var(${f.colorVar})`} size={48} />
                <h4 className="platform-card__title">{f.title}</h4>
                <p className="platform-card__desc">{f.desc}</p>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}
