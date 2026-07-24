/**
 * 解题检查清单（竖向序号；items 支持 React 节点，可含 <strong> 等）
 * @param {{ items: import('react').ReactNode[] }} props
 */
export default function Checklist({ items = [] }) {
  return (
    <ul className="problem-checklist" role="list">
      {items.map((content, index) => (
        <li key={index} className="problem-checklist__item">
          <span className="problem-checklist__mark" aria-hidden="true">
            <span className="problem-checklist__num">{index + 1}</span>
          </span>
          <span className="problem-checklist__text">{content}</span>
        </li>
      ))}
    </ul>
  );
}
