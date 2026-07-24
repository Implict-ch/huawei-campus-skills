import FadeIn, { FADE_STAGGER } from "./FadeIn.jsx";
import ProblemCard from "./ProblemCard.jsx";

export default function CategorySection({
  category,
  sectionIndex = 0,
  basePath = "/acm",
  unitLabel = "题",
}) {
  const { id, title, problems } = category;

  return (
    <FadeIn delay={sectionIndex * FADE_STAGGER}>
      <section
        id={id}
        data-category-id={id}
        className="category-section"
      >
        <h2 className="category-section__title">{title}</h2>
        <p className="category-section__count">共 {problems.length} {unitLabel}</p>
        <div className="problem-grid">
          {problems.map((problem, i) => (
            <ProblemCard key={problem.slug} {...problem} basePath={basePath} index={i} />
          ))}
        </div>
      </section>
    </FadeIn>
  );
}
