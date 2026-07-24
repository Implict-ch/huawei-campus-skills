import { TAG_COLORS } from "../data/content.js";
import { useTheme } from "../context/ThemeContext.jsx";

export function Tag({ label }) {
  const { isDark } = useTheme();

  if (!isDark) {
    return <span className="tag tag--muted">{label}</span>;
  }

  const c = TAG_COLORS[label] || {
    bg: "var(--accent-dim)",
    bd: "var(--accent-border)",
    c: "var(--accent)",
  };

  return (
    <span
      className="tag tag--colored"
      style={{ background: c.bg, color: c.c, borderColor: c.bd }}
    >
      {label}
    </span>
  );
}

export function Badge({ text, color }) {
  const { isDark } = useTheme();

  if (!isDark) {
    return <span className="badge badge--muted">{text}</span>;
  }

  return (
    <span
      className="badge badge--colored"
      style={{
        background: `${color}20`,
        color,
        borderColor: `${color}40`,
      }}
    >
      {text}
    </span>
  );
}
