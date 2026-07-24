import { useState } from "react";
import FadeIn, { FADE_STAGGER_SM } from "./FadeIn.jsx";
import DifficultyBadge from "./DifficultyBadge.jsx";
import AppLink from "./AppLink.jsx";

export default function ProblemCard({
  num,
  title,
  difficulty,
  slug,
  published = false,
  basePath = "/acm",
  index = 0,
}) {
  const [hover, setHover] = useState(false);
  const className = [
    "problem-card",
    !published && "problem-card--draft",
    hover && published && "problem-card--hover",
  ]
    .filter(Boolean)
    .join(" ");

  const inner = (
    <>
      <div className="problem-card__shine" />
      <span className="problem-card__num">#{num}</span>
      <h3 className="problem-card__title">{title}</h3>
      <div className="problem-card__footer">
        <DifficultyBadge difficulty={difficulty} />
        {!published && <span className="problem-card__badge">敬请期待</span>}
      </div>
    </>
  );

  if (!published) {
    return (
      <FadeIn delay={index * FADE_STAGGER_SM}>
        <div className={className} aria-label={`${title}，题解撰写中`}>
          {inner}
        </div>
      </FadeIn>
    );
  }

  return (
    <FadeIn delay={index * FADE_STAGGER_SM}>
      <AppLink
        href={`${basePath}/${slug}`}
        className={className}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
      >
        {inner}
      </AppLink>
    </FadeIn>
  );
}
