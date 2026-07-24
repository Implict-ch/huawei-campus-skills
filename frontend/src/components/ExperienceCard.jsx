import FadeIn, { FADE_STAGGER_SM } from "./FadeIn.jsx";
import GroupedTags from "./GroupedTags.jsx";

function formatDate(dateStr) {
  if (!dateStr) return "日期未知";
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function platformLabel(platform) {
  if (platform === "codefun2000") return "CodeFun2000";
  if (platform === "nowcoder") return "牛客";
  if (platform === "xiaohongshu") return "小红书";
  return platform || "";
}

export default function ExperienceCard({ exp, index }) {
  const source = exp.sourceUrl ? platformLabel(exp.platform) : "";

  return (
    <FadeIn delay={index * FADE_STAGGER_SM}>
      <a
        href={`/experiences/${exp.role}/${encodeURIComponent(exp.id)}`}
        className="experience-card"
      >
        <div className="experience-card__head">
          <h3 className="experience-card__title">{exp.title || exp.id}</h3>
          <span className="experience-card__date">{formatDate(exp.publishedAt)}</span>
        </div>
        <div className="experience-card__footer">
          <GroupedTags tags={exp.tags || []} role={exp.role} maxTags={8} className="experience-card__tags" />
          {source ? <span className="experience-card__source">来源：{source}</span> : null}
        </div>
      </a>
    </FadeIn>
  );
}
