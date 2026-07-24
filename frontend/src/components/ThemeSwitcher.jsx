import { useState, useRef, useEffect } from "react";
import { useTheme } from "../context/ThemeContext.jsx";
import { Icon } from "../icons/index.jsx";

export default function ThemeSwitcher() {
  const { themeId, setThemeId, themeOptions } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const current = themeOptions.find((t) => t.id === themeId) ?? themeOptions[0];

  useEffect(() => {
    if (!open) return;
    const close = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  return (
    <div className="theme-switcher" ref={ref}>
      <button
        type="button"
        className={`theme-switcher__trigger${open ? " theme-switcher__trigger--open" : ""}`}
        title="切换主题"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="theme-switcher__swatches">
          {current.swatch.map((c) => (
            <span key={c} className="theme-switcher__dot" style={{ background: c }} />
          ))}
        </span>
        <span className="theme-switcher__label">{current.label}</span>
        <Icon name="chevron-down" size={14} />
      </button>
      {open && (
        <div className="theme-switcher__menu">
          <div className="theme-switcher__menu-title">界面主题</div>
          {themeOptions.map((opt) => {
            const active = themeId === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                className={`theme-switcher__option${active ? " theme-switcher__option--active" : ""}`}
                onClick={() => {
                  setThemeId(opt.id);
                  setOpen(false);
                }}
              >
                <span className="theme-switcher__swatches">
                  {opt.swatch.map((c) => (
                    <span key={c} className="theme-switcher__dot theme-switcher__dot--lg" style={{ background: c }} />
                  ))}
                </span>
                <span className="theme-switcher__option-text">
                  <span className="theme-switcher__option-name">{opt.label}</span>
                  <span className="theme-switcher__option-desc">{opt.desc}</span>
                </span>
                {active && <Icon name="check" size={14} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
