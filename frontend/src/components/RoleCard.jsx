import FadeIn, { FADE_STAGGER } from "./FadeIn.jsx";
import { IconBox, Icon } from "../icons/index.jsx";

export default function RoleCard({ role, title, icon, iconColor, desc, count, index }) {
  return (
    <FadeIn delay={index * FADE_STAGGER}>
      <a href={`/experiences/${role}`} className="role-card">
        <div className="role-card__head">
          <IconBox icon={icon} color={iconColor} size={44} />
          <div className="role-card__meta">
            <h3 className="role-card__title">{title}</h3>
          </div>
        </div>
        <p className="role-card__desc">{desc}</p>
        <div className="role-card__footer">
          <div className="role-card__link">
            查看全部 <Icon name="arrow" size={14} color="var(--accent)" />
          </div>
          <span className="role-card__count">{count} 篇面经</span>
        </div>
      </a>
    </FadeIn>
  );
}
