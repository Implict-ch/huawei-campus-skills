import { Icon } from "../icons/index.jsx";
import CodeBlock from "./CodeBlock.jsx";

export function IoRuleList({ children }) {
  return <div className="problem-io-rule-list">{children}</div>;
}

export default function IoRule({ title, wrong, right, lang = "cpp" }) {
  return (
    <article className="problem-io-rule">
      <header className="problem-io-rule__header">
        <Icon name="alert-triangle" size={16} color="var(--warning)" />
        <h4 className="problem-io-rule__title">{title}</h4>
      </header>
      <div className="problem-io-rule__compare">
        <div className="problem-io-rule__sample problem-io-rule__sample--wrong">
          <span className="problem-io-rule__sample-label">错误</span>
          <CodeBlock code={wrong} lang={lang} variant="compact" />
        </div>
        <div className="problem-io-rule__sample problem-io-rule__sample--right">
          <span className="problem-io-rule__sample-label">正确</span>
          <CodeBlock code={right} lang={lang} variant="compact" />
        </div>
      </div>
    </article>
  );
}
