import { layoutCompleteBinaryTree, childIndexFormula } from "./treeLayout.js";
import { layoutBfsBinaryTree } from "./bfsTreeModel.js";

const NODE_R = 17;
const COMPACT_NODE_R = 15;

/**
 * @typedef {'default' | 'active' | 'done' | 'dim' | 'leaf'} TreeNodeVariant
 */

/**
 * @param {{
 *   values: (number | null)[];
 *   width?: number;
 *   height?: number;
 *   showIndex?: boolean;
 *   showValue?: boolean;
 *   nodeVariants?: Record<number, TreeNodeVariant>;
 *   edgeFormulas?: boolean;
 *   compact?: boolean;
 *   className?: string;
 *   ariaLabel?: string;
 * }} props
 */
export default function BinaryTreeSvg({
  values,
  width = 320,
  height = 200,
  showIndex = false,
  showValue = true,
  nodeVariants = {},
  edgeFormulas = false,
  compact = false,
  className = "",
  ariaLabel = "二叉树示意",
}) {
  const count = values.length;
  const nodeR = compact ? COMPACT_NODE_R : NODE_R;
  const positions = layoutCompleteBinaryTree(
    count,
    width,
    height,
    compact ? 14 : 20,
    compact ? 12 : 18,
  );

  const edges = [];
  for (let i = 0; i < count; i++) {
    const left = 2 * i + 1;
    const right = 2 * i + 2;
    const from = positions.get(i);
    if (!from) continue;
    if (left < count && positions.has(left)) {
      const to = positions.get(left);
      edges.push({ from, to, parentIdx: i, side: "left", childIdx: left });
    }
    if (right < count && positions.has(right)) {
      const to = positions.get(right);
      edges.push({ from, to, parentIdx: i, side: "right", childIdx: right });
    }
  }

  return (
    <svg
      className={`binary-tree-svg${compact ? " binary-tree-svg--compact" : ""} ${className}`.trim()}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={ariaLabel}
    >
      {edges.map((e) => (
        <g key={`edge-${e.parentIdx}-${e.side}`}>
          <line
            x1={e.from.x}
            y1={e.from.y + nodeR}
            x2={e.to.x}
            y2={e.to.y - nodeR}
            className="binary-tree-svg__edge"
          />
          {edgeFormulas && (
            <text
              x={(e.from.x + e.to.x) / 2}
              y={(e.from.y + e.to.y) / 2 + nodeR * 0.28}
              textAnchor="middle"
              className="binary-tree-svg__edge-label"
            >
              {childIndexFormula(e.parentIdx, e.side)}
            </text>
          )}
        </g>
      ))}

      {Array.from(positions.entries()).map(([idx, pos]) => {
        const variant = nodeVariants[idx] ?? "default";
        const val = values[idx];
        const primary = showIndex ? idx : val;
        const secondary =
          showIndex && showValue && val != null ? String(val) : null;

        return (
          <g key={`node-${idx}`} className={`binary-tree-svg__node-group binary-tree-svg__node-group--${variant}`}>
            <circle
              cx={pos.x}
              cy={pos.y}
              r={nodeR}
              className="binary-tree-svg__node"
            />
            <text
              x={pos.x}
              y={pos.y + (secondary ? -2 : compact ? 2 : 3)}
              textAnchor="middle"
              className="binary-tree-svg__node-text"
            >
              {primary}
            </text>
            {secondary != null && (
              <text
                x={pos.x}
                y={pos.y + 9}
                textAnchor="middle"
                className="binary-tree-svg__node-sub"
              >
                {secondary}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

/**
 * BFS 顺序构建的二叉树（按真实父子关系布局，非堆下标）
 * @param {{
 *   root: import('./bfsTreeModel.js').BfsTreeNode | null;
 *   width?: number;
 *   height?: number;
 *   highlightNodeId?: number | null;
 *   className?: string;
 *   ariaLabel?: string;
 * }} props
 */
export function BfsBuiltTreeSvg({
  root,
  width = 280,
  height = 180,
  highlightNodeId = null,
  className = "",
  ariaLabel = "BFS 构建的二叉树",
}) {
  const positions = layoutBfsBinaryTree(root, width, height);

  /** @type {{ from: { x: number, y: number }, to: { x: number, y: number }, key: string }[]} */
  const edges = [];

  /** @param {import('./bfsTreeModel.js').BfsTreeNode | null} node */
  function collectEdges(node) {
    if (!node) return;
    const from = positions.get(node.id);
    if (!from) return;
    for (const child of [node.left, node.right]) {
      if (!child) continue;
      const to = positions.get(child.id);
      if (to) edges.push({ from, to, key: `${node.id}-${child.id}` });
      collectEdges(child);
    }
  }

  collectEdges(root);

  /** @param {import('./bfsTreeModel.js').BfsTreeNode | null} node */
  function renderNodes(node) {
    if (!node) return null;
    const pos = positions.get(node.id);
    if (!pos) return null;
    const variant = node.id === highlightNodeId ? "active" : "default";

    return (
      <g key={`bfs-node-${node.id}`}>
        {renderNodes(node.left)}
        {renderNodes(node.right)}
        <g className={`binary-tree-svg__node-group binary-tree-svg__node-group--${variant}`}>
          <circle cx={pos.x} cy={pos.y} r={NODE_R} className="binary-tree-svg__node" />
          <text x={pos.x} y={pos.y + 3} textAnchor="middle" className="binary-tree-svg__node-text">
            {node.val}
          </text>
        </g>
      </g>
    );
  }

  return (
    <svg
      className={`binary-tree-svg binary-tree-svg--bfs ${className}`.trim()}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={ariaLabel}
    >
      {edges.map((e) => (
        <line
          key={e.key}
          x1={e.from.x}
          y1={e.from.y + NODE_R}
          x2={e.to.x}
          y2={e.to.y - NODE_R}
          className="binary-tree-svg__edge"
        />
      ))}
      {renderNodes(root)}
    </svg>
  );
}

/**
 * 支持 null 占位的不完全二叉树（仅渲染非 null 节点，但保留 idx 用于连线）
 * @param {{
 *   slots: (number | null)[];
 *   width?: number;
 *   height?: number;
 *   showIndex?: boolean;
 *   className?: string;
 *   ariaLabel?: string;
 * }} props
 */
export function SparseBinaryTreeSvg({
  slots,
  width = 280,
  height = 180,
  showIndex = false,
  className = "",
  ariaLabel = "非完全二叉树示意",
}) {
  const count = slots.length;
  const positions = layoutCompleteBinaryTree(count, width, height);

  const edges = [];
  for (let i = 0; i < count; i++) {
    if (slots[i] == null) continue;
    const from = positions.get(i);
    if (!from) continue;
    for (const side of ["left", "right"]) {
      const childIdx = side === "left" ? 2 * i + 1 : 2 * i + 2;
      if (childIdx >= count || slots[childIdx] == null) continue;
      const to = positions.get(childIdx);
      if (to) edges.push({ from, to, key: `${i}-${childIdx}` });
    }
  }

  return (
    <svg
      className={`binary-tree-svg binary-tree-svg--sparse ${className}`.trim()}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={ariaLabel}
    >
      {edges.map((e) => (
        <line
          key={e.key}
          x1={e.from.x}
          y1={e.from.y + NODE_R}
          x2={e.to.x}
          y2={e.to.y - NODE_R}
          className="binary-tree-svg__edge"
        />
      ))}

      {Array.from(positions.entries()).map(([idx, pos]) => {
        const val = slots[idx];
        if (val == null) return null;
        return (
          <g key={`node-${idx}`} className="binary-tree-svg__node-group binary-tree-svg__node-group--default">
            <circle cx={pos.x} cy={pos.y} r={NODE_R} className="binary-tree-svg__node" />
            <text x={pos.x} y={pos.y + 3} textAnchor="middle" className="binary-tree-svg__node-text">
              {showIndex ? idx : val}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export { NODE_R };
