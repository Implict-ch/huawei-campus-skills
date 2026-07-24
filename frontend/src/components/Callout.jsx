import { Children, isValidElement } from "react";
import { Icon } from "../icons/index.jsx";

/** Callout 类型 → SVG 图标（Lucide 风格路径，见 src/icons/index.jsx） */
const CALLOUT_ICON = {
  info: { name: "info", color: "var(--info)" },
  tip: { name: "lightbulb", color: "var(--success)" },
  warning: { name: "alert-triangle", color: "var(--warning)" },
  danger: { name: "octagon-alert", color: "var(--danger)" },
};

function CalloutIcon({ type }) {
  const { name, color } = CALLOUT_ICON[type] ?? CALLOUT_ICON.info;
  return <Icon name={name} size={20} color={color} className="problem-callout__icon-svg" />;
}

/** 首段若仅为 <p><strong>…</strong></p>，提取为小标题 */
function splitTitleFromChildren(children) {
  const items = Children.toArray(children);
  if (items.length === 0) return { title: null, body: items };

  const first = items[0];
  if (!isValidElement(first) || first.type !== "p") {
    return { title: null, body: items };
  }

  const inner = Children.toArray(first.props.children);
  if (inner.length === 1 && isValidElement(inner[0]) && inner[0].type === "strong") {
    return { title: inner[0].props.children, body: items.slice(1) };
  }

  return { title: null, body: items };
}

/**
 * @param {{
 *   type?: 'info' | 'tip' | 'warning' | 'danger',
 *   title?: import('react').ReactNode,
 *   children: import('react').ReactNode,
 * }} props
 */
export default function Callout({ type = "info", title: titleProp, children }) {
  const split =
    titleProp != null
      ? { title: titleProp, body: Children.toArray(children) }
      : splitTitleFromChildren(children);
  const { title, body } = split;

  return (
    <div className={`problem-callout problem-callout--${type}`} role="note">
      {title != null && title !== "" ? (
        <>
          <div className="problem-callout__head">
            <span className="problem-callout__icon" aria-hidden="true">
              <CalloutIcon type={type} />
            </span>
            <p className="problem-callout__title">{title}</p>
          </div>
          {body.length > 0 ? (
            <div className="problem-callout__content">{body}</div>
          ) : null}
        </>
      ) : (
        <div className="problem-callout__content problem-callout__content--plain">
          <span
            className="problem-callout__icon problem-callout__icon--inline"
            aria-hidden="true"
          >
            <CalloutIcon type={type} />
          </span>
          {children}
        </div>
      )}
    </div>
  );
}
