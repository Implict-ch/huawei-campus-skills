import FadeIn, { FADE_STAGGER, FADE_HERO_STEP } from "./FadeIn.jsx";
import { IconBox, Icon } from "../icons/index.jsx";
import AppLink from "./AppLink.jsx";
import IntroCodeCompare from "./IntroCodeCompare.jsx";

function IntroCtaLink({ href, className, children }) {
  return (
    <AppLink href={href} className={className}>
      {children}
    </AppLink>
  );
}

function Paragraph({ content }) {
  return (
    <p
      className="intro-paragraph"
      dangerouslySetInnerHTML={{ __html: content }}
    />
  );
}

function Highlight({ content }) {
  return (
    <div
      className="intro-highlight"
      dangerouslySetInnerHTML={{ __html: content }}
    />
  );
}

function CardGrid({ columns, cards }) {
  return (
    <div className={`intro-card-grid intro-card-grid--${columns}`}>
      {cards.map((card, i) => (
        <FadeIn key={i} delay={i * FADE_STAGGER}>
          <div className="intro-card">
            <div className="intro-card__shine" />
            <div className="intro-card__head">
              <IconBox icon={card.icon} color={card.iconColor} size={40} />
              <h3 className="intro-card__title">{card.title}</h3>
            </div>
            <p
              className="intro-card__desc"
              dangerouslySetInnerHTML={{ __html: card.desc }}
            />
          </div>
        </FadeIn>
      ))}
    </div>
  );
}

function StatCardGrid({ cards }) {
  return (
    <div className="stat-card-grid">
      {cards.map((card, i) => (
        <FadeIn key={i} delay={i * FADE_STAGGER}>
          <div className="stat-card">
            <div className="stat-card__shine" />
            <div className="stat-card__value">{card.value}</div>
            <div className="stat-card__label">{card.label}</div>
            <div className="stat-card__desc">{card.desc}</div>
          </div>
        </FadeIn>
      ))}
    </div>
  );
}

function NumberedList({ items }) {
  return (
    <ul className="intro-numbered-list">
      {items.map((item, i) => (
        <FadeIn key={i} delay={i * FADE_STAGGER}>
          <li className="intro-numbered-item">
            <span className="intro-numbered-item__num">
              {String(i + 1).padStart(2, "0")}
            </span>
            <div className="intro-numbered-item__body">
              <p className="intro-numbered-item__label">{item.label}</p>
              <p className="intro-numbered-item__content">{item.content}</p>
            </div>
          </li>
        </FadeIn>
      ))}
    </ul>
  );
}

export function renderIntroBlock(block, i) {
  switch (block.type) {
    case "paragraph":
      return <Paragraph key={i} content={block.content} />;
    case "highlight":
      return <Highlight key={i} content={block.content} />;
    case "card-grid":
      return <CardGrid key={i} columns={block.columns} cards={block.cards} />;
    case "stat-cards":
      return <StatCardGrid key={i} cards={block.cards} />;
    case "code-compare":
      return <IntroCodeCompare key={i} panels={block.panels} />;
    case "numbered-list":
      return <NumberedList key={i} items={block.items} />;
    default:
      return null;
  }
}

export function IntroHero({ hero }) {
  const hasBadges = hero.badges?.length > 0;
  let step = 1;

  return (
    <section className="intro-hero">
      <div className="intro-hero__grid-bg" aria-hidden="true" />
      <div className="intro-hero__inner">
        <FadeIn>
          <h1 className="intro-hero__title">{hero.title}</h1>
        </FadeIn>
        <FadeIn delay={FADE_HERO_STEP * step++}>
          <p className="intro-hero__subtitle">{hero.subtitle}</p>
        </FadeIn>
        {hasBadges && (
          <FadeIn delay={FADE_HERO_STEP * step++}>
            <div className="intro-hero__badges">
              {hero.badges.map((b) => (
                <span
                  key={b.text}
                  className={`intro-hero__badge intro-hero__badge--${b.color}`}
                >
                  {b.text}
                </span>
              ))}
            </div>
          </FadeIn>
        )}
        <FadeIn delay={FADE_HERO_STEP * step}>
          <IntroCtaLink href={hero.ctaHref} className="cta-primary cta-primary--lg">
            {hero.ctaText}
            <Icon name="arrow" size={16} color="var(--on-accent)" />
          </IntroCtaLink>
        </FadeIn>
      </div>
    </section>
  );
}

export function IntroSection({ section }) {
  return (
    <section id={section.id} className="intro-section">
      <div className="intro-content">
        <FadeIn>
          <span className="intro-section__label">{section.label}</span>
          <h2 className="intro-section__title">{section.title}</h2>
        </FadeIn>
        {section.blocks.map((block, i) => (
          <FadeIn key={i} delay={FADE_STAGGER}>
            {renderIntroBlock(block, i)}
          </FadeIn>
        ))}
      </div>
    </section>
  );
}

export function IntroQuickStart({ quickStart }) {
  return (
    <section id="quick-start" className="intro-quick-start">
      <FadeIn>
        <div className="intro-quick-start__box">
          <div className="intro-quick-start__shine" />
          <IconBox
            icon={quickStart.icon ?? "fire"}
            color="var(--accent)"
            size={44}
          />
          <h2 className="intro-quick-start__title">
            {quickStart.titleIcon && (
              <Icon
                name={quickStart.titleIcon}
                size={22}
                color="var(--accent)"
              />
            )}
            {quickStart.title}
          </h2>
          <p className="intro-quick-start__desc">{quickStart.desc}</p>
          <IntroCtaLink href={quickStart.ctaHref} className="cta-primary cta-primary--lg">
            {quickStart.ctaIcon && (
              <Icon
                name={quickStart.ctaIcon}
                size={16}
                color="var(--on-accent)"
              />
            )}
            {quickStart.ctaText}
            <Icon name="arrow" size={16} color="var(--on-accent)" />
          </IntroCtaLink>
        </div>
      </FadeIn>
    </section>
  );
}
