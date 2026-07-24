/**
 * 完全二叉树：按数组下标递归布局（中序分半宽度）
 * @param {number} count 节点个数（下标 0 .. count-1 均存在）
 * @param {number} viewW
 * @param {number} viewH
 * @param {number} [padX]
 * @param {number} [padY]
 */
export function layoutCompleteBinaryTree(count, viewW, viewH, padX = 20, padY = 18) {
  /** @type {Map<number, { x: number, y: number, depth: number, idx: number }>} */
  const positions = new Map();
  let maxDepth = 0;

  function dfs(idx, depth, left, right) {
    if (idx >= count) return;
    maxDepth = Math.max(maxDepth, depth);
    const x = (left + right) / 2;
    positions.set(idx, { x, y: 0, depth, idx });
    const mid = (left + right) / 2;
    dfs(2 * idx + 1, depth + 1, left, mid);
    dfs(2 * idx + 2, depth + 1, mid, right);
  }

  if (count > 0) {
    dfs(0, 0, padX, viewW - padX);
  }

  const depthSpan = Math.max(maxDepth, 1);
  for (const pos of positions.values()) {
    pos.y = padY + (pos.depth / depthSpan) * (viewH - 2 * padY);
  }

  return positions;
}

/** @param {number} parentIdx @param {'left' | 'right'} side */
export function childIndexFormula(parentIdx, side) {
  return side === "left" ? `2×${parentIdx}+1` : `2×${parentIdx}+2`;
}
