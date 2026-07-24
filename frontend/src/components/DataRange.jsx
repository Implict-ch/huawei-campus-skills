/**
 * @param {{
 *   children?: import('react').ReactNode,
 *   items?: import('react').ReactNode[],
 * }} props
 */
export default function DataRange({ children, items }) {
  const multi = Array.isArray(items) && items.length > 0;

  return (
    <div
      className={`problem-data-range${multi ? " problem-data-range--stack" : ""}`}
    >
      <span className="problem-data-range__label">数据范围</span>
      {multi ? (
        <ul className="problem-data-range__list">
          {items.map((item, index) => (
            <li key={index} className="problem-data-range__item">
              {item}
            </li>
          ))}
        </ul>
      ) : (
        <span className="problem-data-range__value">{children}</span>
      )}
    </div>
  );
}
