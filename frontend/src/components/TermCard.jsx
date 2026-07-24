/**
 * 术语卡片（概念解释，info 色调，非 warning）
 * @param {{ term: string, children: import('react').ReactNode }} props
 */
export default function TermCard({ term, children }) {
  return (
    <div className="problem-term-card" role="note">
      <div className="problem-term-card__term" aria-hidden="true">
        {term}
      </div>
      <div className="problem-term-card__body">{children}</div>
    </div>
  );
}
