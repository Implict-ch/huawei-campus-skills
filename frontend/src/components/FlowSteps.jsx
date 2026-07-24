import { Children, isValidElement } from "react";
import { Icon } from "../icons/index.jsx";

function FlowConnector() {
  return (
    <div className="problem-flow-steps__connector" aria-hidden="true">
      <svg
        className="problem-flow-steps__connector-svg"
        viewBox="0 0 56 16"
        width="56"
        height="16"
        fill="none"
      >
        <line
          x1="2"
          y1="8"
          x2="46"
          y2="8"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeDasharray="5 4"
          strokeLinecap="round"
        />
        <path
          d="M42 4 L50 8 L42 12"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

/**
 * 流程卡片（须作为 FlowSteps 子节点）
 * @param {{
 *   title: string,
 *   icon?: string,
 *   visual?: import('react').ReactNode,
 *   children?: import('react').ReactNode,
 * }} props
 * 第二行：有 visual 则显示文字/自定义节点，否则显示 icon 对应 SVG
 */
export function FlowStep({ title, icon, visual, children }) {
  return (
    <div className="problem-flow-step">
      <div className="problem-flow-step__title">{title}</div>
      <div className="problem-flow-step__visual">
        {visual != null ? (
          <div className="problem-flow-step__visual-text">{visual}</div>
        ) : icon ? (
          <Icon name={icon} size={28} color="var(--accent)" />
        ) : null}
      </div>
      {children != null && children !== "" ? (
        <div className="problem-flow-step__detail">{children}</div>
      ) : null}
    </div>
  );
}

/**
 * @param {{
 *   simple?: boolean,
 *   title?: string,
 *   headerIcon?: string,
 *   children: import('react').ReactNode,
 * }} props
 * simple：仅一行步骤卡片 + 连接线，无顶栏、无外层白底边框
 */
export default function FlowSteps({
  simple = false,
  title,
  headerIcon = "workflow",
  children,
}) {
  const steps = Children.toArray(children).filter(
    (child) =>
      isValidElement(child) &&
      (child.type === FlowStep || child.type?.displayName === "FlowStep"),
  );

  const rootClass = simple
    ? "problem-flow-steps problem-flow-steps--simple"
    : "problem-flow-steps";

  const ariaLabel = title?.trim() || "流程步骤";

  return (
    <section className={rootClass} aria-label={ariaLabel}>
      {!simple && title ? (
        <header className="problem-flow-steps__header">
          <span className="problem-flow-steps__header-icon" aria-hidden="true">
            <Icon name={headerIcon} size={22} color="var(--accent)" />
          </span>
          <h3 className="problem-flow-steps__heading">{title}</h3>
        </header>
      ) : null}

      <div className="problem-flow-steps__track">
        {steps.map((step, index) => (
          <div key={step.key ?? index} className="problem-flow-steps__segment">
            {step}
            {index < steps.length - 1 ? <FlowConnector /> : null}
          </div>
        ))}
      </div>
    </section>
  );
}

FlowStep.displayName = "FlowStep";
