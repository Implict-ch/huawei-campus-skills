/**
 * 节点间连线（紧贴节点边界，水平居中）
 * @param {{ variant: 'solid' | 'dashed' | 'dashed-fade' | 'dashed-grow' | 'dashed-draw', width?: number, className?: string }} props
 */
export default function ListLinkEdge({
  variant = "solid",
  width = 48,
  className = "",
}) {
  const dashed = variant !== "solid";

  return (
    <div
      className={`list-link-edge list-link-edge--${variant}${className ? ` ${className}` : ""}`}
      style={{ width }}
      aria-hidden="true"
    >
      <svg
        className="list-link-edge__svg"
        viewBox={`0 0 ${width} 24`}
        width={width}
        height={24}
      >
        <line
          x1="0"
          y1="12"
          x2={width}
          y2="12"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray={dashed ? "6 5" : undefined}
        />
        {variant === "solid" && (
          <polygon
            points={`${width - 10},7 ${width},12 ${width - 10},17`}
            fill="currentColor"
            stroke="none"
          />
        )}
      </svg>
    </div>
  );
}
