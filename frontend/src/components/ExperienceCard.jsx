import { useState } from "react";
import FadeIn, { FADE_STAGGER_SM } from "./FadeIn.jsx";
import { Tag } from "./Tag.jsx";

function formatDate(dateStr) {
  if (!dateStr) return "日期未知";
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function ExperienceCard({ exp, index }) {
  const [hover, setHover] = useState(false);

  return (
    <FadeIn delay={index * FADE_STAGGER_SM}>
      <a
        href={`/experiences/${exp.role}/${encodeURIComponent(exp.id)}`}
        className={`experience-card${hover ? " experience-card--hover" : ""}`}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
      >
        <div className="experience-card__shine" />
        <div className="experience-card__head">
          <span className="experience-card__date">{formatDate(exp.publishedAt)}</span>
          <span className="experience-card__grade">{exp.sourceGrade}</span>
        </div>
        <h3 className="experience-card__title">{exp.title || exp.id}</h3>
        <div className="experience-card__tags">
          {exp.tags.slice(0, 4).map((t) => (
            <Tag key={t} label={t} />
          ))}
        </div>
        {exp.sourceUrl && (
          <div className="experience-card__source">
            来源：{exp.platform === "codefun2000" ? "CodeFun2000" : exp.platform === "nowcoder" ? "牛客" : exp.platform === "xiaohongshu" ? "小红书" : exp.platform}
          </div>
        )}
      </a>
    </FadeIn>
  );
}
