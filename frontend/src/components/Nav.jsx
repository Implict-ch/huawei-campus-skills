import { useState, useEffect } from "react";
import { NAV_LINKS } from "../data/content.js";
import { Icon } from "../icons/index.jsx";
import AppLink from "./AppLink.jsx";
import ThemeSwitcher from "./ThemeSwitcher.jsx";

export default function Nav({
  links = NAV_LINKS,
  homeHref = "/",
  showCta = true,
  ctaHref,
  ctaText = "开始使用",
}) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav className={`nav${scrolled ? " nav--scrolled" : ""}`}>
      <AppLink href={homeHref} className="nav__brand">
        <div className="nav__logo">塔</div>
        <span className="nav__title">
          CodeFun<span className="nav__title-accent">2000</span>
        </span>
      </AppLink>
      <div className="nav__links">
        {links.map((n) => (
          <AppLink
            key={n.label}
            href={n.href}
            className="nav__link"
            {...(n.external ? { target: "_blank", rel: "noreferrer" } : {})}
          >
            {n.label}
          </AppLink>
        ))}
      </div>
      <div className="nav__actions">
        <ThemeSwitcher />
        {showCta && ctaHref ? (
          <AppLink href={ctaHref} className="cta-primary cta-primary--sm">
            {ctaText} <Icon name="arrow" size={14} color="var(--on-accent)" />
          </AppLink>
        ) : null}
      </div>
    </nav>
  );
}
