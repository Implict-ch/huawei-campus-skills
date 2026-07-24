import { Icon } from "../icons/index.jsx";
import AppLink from "./AppLink.jsx";

function NavCard({ item, direction, basePath }) {
  const isPrev = direction === "prev";
  const className = `prev-next__card prev-next__card--${direction}`;

  if (!item.published) {
    return (
      <div className={`${className} prev-next__card--disabled`} aria-disabled="true">
        <div className="prev-next__dir">
          {isPrev && <Icon name="arrow-left" size={14} color="var(--text-muted)" />}
          {isPrev ? "上一题" : "下一题"}
          {!isPrev && <Icon name="arrow" size={14} color="var(--text-muted)" />}
        </div>
        <div className="prev-next__title">
          #{item.num} {item.title}
        </div>
        <span className="prev-next__badge">敬请期待</span>
      </div>
    );
  }

  return (
    <AppLink href={`${basePath}/${item.slug}`} className={className}>
      <div className="prev-next__dir">
        {isPrev && <Icon name="arrow-left" size={14} color="var(--text-muted)" />}
        {isPrev ? "上一题" : "下一题"}
        {!isPrev && <Icon name="arrow" size={14} color="var(--text-muted)" />}
      </div>
      <div className="prev-next__title">
        #{item.num} {item.title}
      </div>
    </AppLink>
  );
}

export default function PrevNext({ prev, next, basePath = "/acm" }) {
  if (!prev && !next) return null;

  return (
    <nav className="prev-next" aria-label="题目导航">
      {prev ? <NavCard item={prev} direction="prev" basePath={basePath} /> : <div />}
      {next ? <NavCard item={next} direction="next" basePath={basePath} /> : <div />}
    </nav>
  );
}
