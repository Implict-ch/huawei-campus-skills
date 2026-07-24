import FadeIn from "./FadeIn.jsx";
import SectionHeader from "./SectionHeader.jsx";
import ProductCard from "./ProductCard.jsx";

export default function ProductSection({
  id,
  sectionLabel,
  sectionTitle,
  sectionDesc,
  items,
}) {
  const gridClass =
    items.length === 1
      ? "product-grid product-grid--single"
      : items.length === 2
        ? "product-grid product-grid--double"
        : "product-grid";

  return (
    <section className="section" id={id}>
      <div className="container">
        <FadeIn>
          <SectionHeader
            id={id}
            label={sectionLabel}
            title={sectionTitle}
            desc={sectionDesc}
          />
        </FadeIn>
        <div className={gridClass}>
          {items.map((item, i) => (
            <ProductCard key={item.title} index={i} {...item} />
          ))}
        </div>
      </div>
    </section>
  );
}
