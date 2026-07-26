import { Link } from "react-router-dom";
import { isInternalPath, withAgentReferrer } from "../utils.js";

export default function SourceListPanel({ sources }) {
  const items = (sources || []).filter((s) => s && (s.title || s.sourceUrl));
  if (!items.length) return null;
  return (
    <ul className="agent-retrieved__list">
      {items.map((s, i) => {
        const label = s.title || s.sourceUrl;
        const indexPrefix = `[${i + 1}]`;
        const body = s.sourceUrl ? (
          isInternalPath(s.sourceUrl) ? (
            <Link to={withAgentReferrer(s.sourceUrl)} state={{ from: "agent" }}>
              {indexPrefix} {label}
            </Link>
          ) : (
            <a href={s.sourceUrl} target="_blank" rel="noopener noreferrer">
              {indexPrefix} {label}
            </a>
          )
        ) : (
          <span>
            {indexPrefix} {label}
          </span>
        );
        return (
          <li key={s.id || `${s.title}-${i}`} className="agent-retrieved__item">
            {body}
          </li>
        );
      })}
    </ul>
  );
}
