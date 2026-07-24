export default function SectionHeader({ id, label, title, desc }) {
  return (
    <div id={id} className="section-header">
      <span className="section-label">{label}</span>
      <h2 className="section-title">{title}</h2>
      {desc && <p className="section-desc">{desc}</p>}
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
