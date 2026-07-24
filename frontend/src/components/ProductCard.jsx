import { useState } from "react";
import FadeIn, { FADE_STAGGER } from "./FadeIn.jsx";
import { Tag, Badge } from "./Tag.jsx";
import { Icon, IconBox } from "../icons/index.jsx";

export default function ProductCard({ title, icon, iconColor, tags, desc, badge, badgeColor, link, index }) {
  const [hover, setHover] = useState(false);

  return (
    <FadeIn delay={index * FADE_STAGGER}>
      <a
        href={link || "#"}
        className={`product-card${hover ? " product-card--hover" : ""}`}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
      >
        <div className="product-card__shine" />
        <div className="product-card__head">
          <IconBox icon={icon} color={iconColor} size={44} />
          <h3 className="product-card__title">{title}</h3>
          {badge && <Badge text={badge} color={badgeColor} />}
        </div>
        <div className="product-card__tags">
          {tags.map((t) => (
            <Tag key={t} label={t} />
          ))}
        </div>
        <p className="product-card__desc">{desc}</p>
        <div className="product-card__link">
          查看详情 <Icon name="arrow" size={14} color="var(--accent)" />
        </div>
      </a>
    </FadeIn>
  );
}
