import { Link } from "react-router-dom";

const SPA_BASENAME = "/acm";

/**
 * 将对外 URL（/acm/...）转为相对 basename 的 Router 路径。
 * @param {string} href
 * @returns {string | null} Router `to`；null 表示不走 SPA Link
 */
export function toSpaPath(href) {
  if (!href || typeof href !== "string") return null;
  if (href.startsWith("#")) return null;
  if (!href.startsWith(SPA_BASENAME)) return null;
  if (href === SPA_BASENAME) return "/";
  if (href.startsWith(`${SPA_BASENAME}/`)) {
    return href.slice(SPA_BASENAME.length) || "/";
  }
  return null;
}

/** 站内绝对路径（含 /intro 等 SPA 外页面） */
export function isInternalHref(href) {
  return typeof href === "string" && href.startsWith("/") && !href.startsWith("//");
}

export default function AppLink({ href, to, className, children, ...rest }) {
  const dest = to ?? href;
  const spaPath = typeof dest === "string" ? toSpaPath(dest) : null;

  if (spaPath != null) {
    return (
      <Link to={spaPath} className={className} {...rest}>
        {children}
      </Link>
    );
  }

  if (typeof dest === "string" && (dest.startsWith("#") || isInternalHref(dest))) {
    return (
      <a href={dest} className={className} {...rest}>
        {children}
      </a>
    );
  }

  return (
    <a href={dest} className={className} {...rest}>
      {children}
    </a>
  );
}
