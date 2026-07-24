/**
 * @typedef {Object} BfsTreeNode
 * @property {number} id
 * @property {number} val
 * @property {number} sourceIndex 对应 nums 中的下标
 * @property {BfsTreeNode | null} left
 * @property {BfsTreeNode | null} right
 */

/**
 * 按 BFS 顺序从层序数组构建二叉树（-1 表示空孩子）
 * @param {number[]} nums
 * @returns {BfsTreeNode | null}
 */
export function buildBfsTreeFromArray(nums) {
  if (!nums.length || nums[0] === -1) return null;

  /** @type {BfsTreeNode} */
  const root = { id: 0, val: nums[0], sourceIndex: 0, left: null, right: null };
  /** @type {BfsTreeNode[]} */
  const queue = [root];
  let nextId = 1;
  let index = 1;

  while (queue.length > 0 && index < nums.length) {
    const cur = queue.shift();

    if (index < nums.length) {
      if (nums[index] !== -1) {
        cur.left = {
          id: nextId++,
          val: nums[index],
          sourceIndex: index,
          left: null,
          right: null,
        };
        queue.push(cur.left);
      }
      index += 1;
    }

    if (index < nums.length) {
      if (nums[index] !== -1) {
        cur.right = {
          id: nextId++,
          val: nums[index],
          sourceIndex: index,
          left: null,
          right: null,
        };
        queue.push(cur.right);
      }
      index += 1;
    }
  }

  return root;
}

/**
 * 仅保留 sourceIndex 在 builtSourceIndices 中的节点（保留与它们的连边）
 * @param {BfsTreeNode | null} node
 * @param {Set<number>} builtSourceIndices
 * @returns {BfsTreeNode | null}
 */
export function pruneBfsTreeBySourceIndices(node, builtSourceIndices) {
  if (!node || !builtSourceIndices.has(node.sourceIndex)) return null;

  return {
    ...node,
    left: node.left ? pruneBfsTreeBySourceIndices(node.left, builtSourceIndices) : null,
    right: node.right ? pruneBfsTreeBySourceIndices(node.right, builtSourceIndices) : null,
  };
}

/**
 * @param {BfsTreeNode | null} root
 * @param {number} viewW
 * @param {number} viewH
 * @param {number} [padX]
 * @param {number} [padY]
 */
export function layoutBfsBinaryTree(root, viewW, viewH, padX = 20, padY = 18) {
  /** @type {Map<number, { x: number, y: number, depth: number }>} */
  const positions = new Map();
  if (!root) return positions;

  let maxDepth = 0;

  /**
   * 左子树占左半区、右子树占右半区，单子节点时自然偏左/偏右
   * @param {BfsTreeNode | null} node
   * @param {number} depth
   * @param {number} left
   * @param {number} right
   */
  function assign(node, depth, left, right) {
    if (!node) return;
    maxDepth = Math.max(maxDepth, depth);
    const mid = (left + right) / 2;
    positions.set(node.id, { x: mid, y: 0, depth });

    if (node.left) {
      assign(node.left, depth + 1, left, mid);
    }
    if (node.right) {
      assign(node.right, depth + 1, mid, right);
    }
  }

  assign(root, 0, padX, viewW - padX);

  const depthSpan = Math.max(maxDepth, 1);
  for (const pos of positions.values()) {
    pos.y = padY + (pos.depth / depthSpan) * (viewH - 2 * padY);
  }

  return positions;
}

/** @param {BfsTreeNode | null} root @param {number} sourceIndex */
export function findNodeIdBySourceIndex(root, sourceIndex) {
  if (!root) return null;
  if (root.sourceIndex === sourceIndex) return root.id;
  return (
    findNodeIdBySourceIndex(root.left, sourceIndex) ??
    findNodeIdBySourceIndex(root.right, sourceIndex)
  );
}

/** @param {BfsTreeNode | null} root @param {number} val */
export function findNodeIdByValue(root, val) {
  if (!root) return null;
  if (root.val === val) return root.id;
  return findNodeIdByValue(root.left, val) ?? findNodeIdByValue(root.right, val);
}
