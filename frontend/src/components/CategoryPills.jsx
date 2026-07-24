export default function CategoryPills({ categories, activeId, onSelect, className = "" }) {
  return (
    <div className={`category-pills ${className}`.trim()}>
      {categories.map((cat) => (
        <button
          key={cat.id}
          type="button"
          className={`category-pills__item tag${activeId === cat.id ? " category-pills__item--active" : ""}`}
          onClick={() => onSelect(cat.id)}
        >
          {cat.title}
        </button>
      ))}
    </div>
  );
}
