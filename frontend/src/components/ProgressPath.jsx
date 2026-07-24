import { Icon } from "../icons/index.jsx";

/**
 * ACM 系列递进路径（横向节点 + 连接线）
 * @param {{ items: { label: string, status: 'done' | 'current' | 'upcoming' }[] }} props
 */
export default function ProgressPath({ items = [] }) {
  return (
    <nav className="problem-progress-path" aria-label="系列学习进度">
      <ol className="problem-progress-path__list">
        {items.map((item, index) => (
          <li
            key={item.label}
            className={`problem-progress-path__item problem-progress-path__item--${item.status}`}
          >
            {index > 0 ? (
              <span className="problem-progress-path__connector" aria-hidden="true" />
            ) : null}
            <div className="problem-progress-path__node">
              <span className="problem-progress-path__badge" aria-hidden="true">
                {item.status === "done" ? (
                  <Icon name="check" size={14} color="var(--text-muted)" />
                ) : (
                  <span className="problem-progress-path__index">{index + 1}</span>
                )}
              </span>
              <span className="problem-progress-path__label">{item.label}</span>
            </div>
          </li>
        ))}
      </ol>
    </nav>
  );
}
