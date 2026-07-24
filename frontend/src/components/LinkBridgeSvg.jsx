/**
 * 从链上节点右侧 → 下方 pending 节点左侧的曲线（用于 link-tail）
 * @param {{ x1: number, y1: number, x2: number, y2: number, animate?: boolean }} props
 */
export default function LinkBridgeSvg({ x1, y1, x2, y2, viewW = 400, viewH = 168, animate = false }) {
  const midY = (y1 + y2) / 2;
  const d = `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`;

  return (
    <svg
      className={`link-bridge-svg${animate ? " link-bridge-svg--animate" : ""}`}
      viewBox={`0 0 ${viewW} ${viewH}`}
      preserveAspectRatio="xMinYMin meet"
      aria-hidden="true"
    >
      <path
        d={d}
        className="link-bridge-svg__path"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
