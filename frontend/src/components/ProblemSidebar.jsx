import { Icon } from "../icons/index.jsx";

export default function ProblemSidebar({
  categories,
  activeId,
  onSelect,
  title = "Hot 100 导航",
  icon = "fire",
}) {
  return (
    <aside className="problem-sidebar">
      <div className="problem-sidebar__header">
        <Icon name={icon} size={16} color="var(--accent)" />
        <span className="problem-sidebar__title">{title}</span>
      </div>
      <div className="problem-sidebar__divider" />
      <nav className="problem-sidebar__nav">
        {categories.map((cat) => {
          const isActive = activeId === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              className={`problem-sidebar__item${isActive ? " problem-sidebar__item--active" : ""}`}
              onClick={() => onSelect(cat.id)}
            >
              <span className="problem-sidebar__item-label">
                {isActive && (
                  <span className="problem-sidebar__dot" aria-hidden="true">
                    ●
                  </span>
                )}
                {cat.title}
              </span>
              <span className="problem-sidebar__count">({cat.problems.length})</span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
