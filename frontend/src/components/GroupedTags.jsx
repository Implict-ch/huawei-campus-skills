import { Tag } from "./Tag.jsx";
import { groupTagsByRole } from "../data/keywordGroups.js";

/**
 * 按岗位将 tags 分区展示，组间用分割线隔开。
 */
export default function GroupedTags({ tags, role, maxTags = 12, className = "" }) {
  const limited = (tags || []).slice(0, maxTags);
  const groups = groupTagsByRole(limited, role).filter((g) => g.tags.length > 0);

  if (!groups.length) return null;

  return (
    <div className={`grouped-tags ${className}`.trim()}>
      {groups.map((g, idx) => (
        <div key={g.group} className="grouped-tags__group">
          {idx > 0 && <div className="grouped-tags__divider" aria-hidden="true" />}
          <div className="grouped-tags__tags">
            {g.tags.map((t) => (
              <Tag key={t} label={t} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
