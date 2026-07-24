import { Icon } from "../icons/index.jsx";

/**
 * 跨语言类型对照（紧凑三列）
 * @param {{ items: Array<{ lang: string, type: string, note: string, highlight?: boolean }> }} props
 */
export default function LangCompare({ items }) {
  return (
    <div className="problem-lang-compare">
      {items.map((item) => (
        <div
          key={item.lang}
          className={`problem-lang-compare__col${
            item.highlight ? " problem-lang-compare__col--highlight" : ""
          }`}
        >
          <span className="problem-lang-compare__lang">{item.lang}</span>
          <code className="problem-lang-compare__type">{item.type}</code>
          <p className="problem-lang-compare__note">{item.note}</p>
          {item.highlight ? (
            <span className="problem-lang-compare__mark">
              <Icon name="zap" size={12} color="var(--success)" />
              更省心
            </span>
          ) : null}
        </div>
      ))}
    </div>
  );
}
