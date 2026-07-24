const S = { strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" };

function Svg({ children, size = 24, color = "currentColor", className, ...rest }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={S.strokeWidth}
      strokeLinecap={S.strokeLinecap}
      strokeLinejoin={S.strokeLinejoin}
      className={className}
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  );
}

const paths = {
  target: () => (
    <>
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </>
  ),
  code: () => (
    <>
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </>
  ),
  book: () => (
    <>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </>
  ),
  building: () => (
    <>
      <rect x="4" y="2" width="16" height="20" rx="2" />
      <path d="M9 22v-4h6v4" />
      <path d="M8 6h.01M16 6h.01M12 6h.01M12 10h.01M12 14h.01M16 10h.01M16 14h.01M8 10h.01M8 14h.01" />
    </>
  ),
  map: () => (
    <>
      <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" />
      <line x1="9" y1="3" x2="9" y2="18" />
      <line x1="15" y1="6" x2="15" y2="21" />
    </>
  ),
  zap: () => <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />,
  fire: () => (
    <path d="M12 12c2-2.96 0-7-1-8 0 3.038-1.773 4.741-3 6-1.226 1.26-2 3.24-2 5a6 6 0 1 0 12 0c0-1.532-1.056-3.94-2-5-1.786 3-2.791 3-4 2z" />
  ),
  brain: () => (
    <>
      <path d="M9.5 2A5.5 5.5 0 0 0 5 5.65 5.5 5.5 0 0 0 5.14 16.4 5.5 5.5 0 0 0 9.5 22h.5" />
      <path d="M14.5 2A5.5 5.5 0 0 1 19 5.65a5.5 5.5 0 0 1-.14 10.75A5.5 5.5 0 0 1 14.5 22h-.5" />
      <path d="M12 2v20" />
    </>
  ),
  terminal: () => (
    <>
      <polyline points="4 17 10 11 4 5" />
      <line x1="12" y1="19" x2="20" y2="19" />
    </>
  ),
  robot: () => (
    <>
      <rect x="3" y="11" width="18" height="10" rx="2" />
      <circle cx="12" cy="5" r="2" />
      <path d="M12 7v4" />
      <circle cx="8" cy="16" r="1" fill="currentColor" stroke="none" />
      <circle cx="16" cy="16" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  globe: () => (
    <>
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </>
  ),
  chart: () => (
    <>
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </>
  ),
  judge: () => (
    <>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M9 9l6 6M15 9l-6 6" />
    </>
  ),
  play: () => <polygon points="5 3 19 12 5 21 5 3" fill="currentColor" stroke="none" />,
  pause: () => (
    <>
      <rect x="6" y="4" width="4" height="16" fill="currentColor" stroke="none" />
      <rect x="14" y="4" width="4" height="16" fill="currentColor" stroke="none" />
    </>
  ),
  "monitor-play": () => (
    <>
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <polygon points="10 8 10 16 16 12" fill="currentColor" stroke="none" />
    </>
  ),
  send: () => <path d="M22 2L11 13M22 2L15 22L11 13L2 9L22 2Z" />,
  write: () => (
    <>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </>
  ),
  search: () => (
    <>
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </>
  ),
  users: () => (
    <>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  star: () => (
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  ),
  pin: () => (
    <>
      <path d="M12 17v5" />
      <path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z" />
    </>
  ),
  check: () => <polyline points="20 6 9 17 4 12" />,
  clock: () => (
    <>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </>
  ),
  "hard-drive": () => (
    <>
      <line x1="22" y1="12" x2="2" y2="12" />
      <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
      <line x1="6" y1="16" x2="6.01" y2="16" />
      <line x1="10" y1="16" x2="10.01" y2="16" />
    </>
  ),
  arrow: () => (
    <>
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </>
  ),
  "arrow-left": () => (
    <>
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </>
  ),
  "arrow-right": () => (
    <>
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </>
  ),
  plus: () => (
    <>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </>
  ),
  maximize: () => (
    <>
      <path d="M8 3H5a2 2 0 0 0-2 2v3" />
      <path d="M16 3h3a2 2 0 0 1 2 2v3" />
      <path d="M21 16v3a2 2 0 0 1-2 2h-3" />
      <path d="M3 16v3a2 2 0 0 0 2 2h3" />
    </>
  ),
  minimize: () => (
    <>
      <path d="M4 14h6v6" />
      <path d="M20 10h-6V4" />
      <path d="M14 10l7-7" />
      <path d="M3 21l7-7" />
    </>
  ),
  copy: () => (
    <>
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </>
  ),
  "external-link": () => (
    <>
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </>
  ),
  "skip-back": () => (
    <>
      <polygon points="19 20 9 12 19 4 19 20" fill="currentColor" stroke="none" />
      <line x1="5" y1="19" x2="5" y2="5" />
    </>
  ),
  "skip-forward": () => (
    <>
      <polygon points="5 4 15 12 5 20 5 4" fill="currentColor" stroke="none" />
      <line x1="19" y1="5" x2="19" y2="19" />
    </>
  ),
  layers: () => (
    <>
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <polyline points="2 17 12 22 22 17" />
      <polyline points="2 12 12 17 22 12" />
    </>
  ),
  "chevron-down": () => <polyline points="6 9 12 15 18 9" />,
  rocket: () => (
    <>
      <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
      <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
      <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
      <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
    </>
  ),
  "book-open": () => (
    <>
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </>
  ),
  "alert-triangle": () => (
    <>
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </>
  ),
  info: () => (
    <>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </>
  ),
  lightbulb: () => (
    <>
      <path d="M9 18h6" />
      <path d="M10 22h4" />
      <path d="M15.09 14A7 7 0 1 0 8.91 14" />
    </>
  ),
  "octagon-alert": () => (
    <>
      <polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </>
  ),
  workflow: () => (
    <>
      <rect x="2" y="3" width="7" height="5" rx="1.5" />
      <rect x="15" y="3" width="7" height="5" rx="1.5" />
      <rect x="8.5" y="16" width="7" height="5" rx="1.5" />
      <path d="M9 5.5h6M12 8v5.5M8.5 18.5H5" />
    </>
  ),
  "split-cells": () => (
    <>
      <rect x="2" y="6" width="5" height="12" rx="1" />
      <rect x="9.5" y="6" width="5" height="12" rx="1" />
      <rect x="17" y="6" width="5" height="12" rx="1" />
    </>
  ),
  sigma: () => (
    <>
      <path d="M4 7h16" />
      <path d="M4 12h12" />
      <path d="M4 17h8" />
    </>
  ),
  "file-text": () => (
    <>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <line x1="10" y1="9" x2="8" y2="9" />
    </>
  ),
  "course-cpp": () => (
    <>
      <rect x="4" y="5" width="16" height="14" rx="2.5" />
      <path d="M8.5 9v6" />
      <path d="M8.5 12h2.5" />
      <path d="M13.5 9v6" />
      <path d="M16.5 9v6" />
    </>
  ),
  "course-python": () => (
    <>
      <path d="M12 3.5c-3.2 0-4.8 1.1-4.8 2.8v2.2H12v1H5.8C3.6 9.5 2.5 11 2.5 13.2s1.1 3.7 3.3 3.7H7v-2c0-1.4 1.1-2.5 2.5-2.5h5c2.2 0 4-1.8 4-4s-1.8-4-4-4H12v-2.9z" />
      <circle cx="9.2" cy="6.2" r="1" fill="currentColor" stroke="none" />
      <circle cx="14.8" cy="17.8" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  "course-java": () => (
    <>
      <path d="M7.5 5.5c3.8 2.2 7.5 4 7.5 8s-3.7 5.8-7.5 8" />
      <path d="M7.5 10c2 1.1 3.8 2 3.8 3.8s-1.8 2.7-3.8 3.7" />
      <path d="M11.5 19.8c-1 .5-2 .8-3.2.8" />
      <path d="M14 5.5c1.2.8 2 1.8 2 3" />
    </>
  ),
};

export function Icon({ name, size = 24, color = "currentColor", className }) {
  const render = paths[name];
  if (!render) return null;
  return (
    <Svg size={size} color={color} className={className}>
      {render()}
    </Svg>
  );
}

export function IconBox({ icon, color, size = 44 }) {
  return (
    <div
      className="icon-box"
      style={{
        "--icon-box-color": color,
        width: size,
        height: size,
        borderRadius: size > 40 ? 14 : 10,
      }}
    >
      <Icon name={icon} size={size * 0.5} color={color} />
    </div>
  );
}
