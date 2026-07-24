import FadeIn from "./FadeIn.jsx";
import { Icon, IconBox } from "../icons/index.jsx";

export default function CtaBanner() {
  return (
    <section className="section section--cta">
      <div className="container container--narrow">
        <FadeIn>
          <div className="cta-banner">
            <div className="cta-banner__shine" />
            <IconBox icon="star" color="var(--accent)" size={56} />
            <h2 className="cta-banner__title">准备好冲刺校招了吗？</h2>
            <p className="cta-banner__desc">注册即可开始，5000+ 真题等你来练</p>
            <a href="#" className="cta-primary cta-primary--lg">
              开始使用 <Icon name="arrow" size={16} color="var(--on-accent)" />
            </a>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
