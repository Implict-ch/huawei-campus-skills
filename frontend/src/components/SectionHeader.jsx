export default function SectionHeader({ id, label, title, desc, meta }) {
  return (
    <div id={id} className={`section-header${meta ? " section-header--with-meta" : ""}`}>
      {label ? <span className="section-label">{label}</span> : null}
      <div className="section-header__title-row">
        <h2 className="section-title">{title}</h2>
        {meta ? <span className="section-header__meta">{meta}</span> : null}
      </div>
      {desc ? <p className="section-desc">{desc}</p> : null}
    </div>
  );
}

export function Divider() {
  return (
    <div className="separator">
      <div className="separator__line" />
    </div>
  );
}
