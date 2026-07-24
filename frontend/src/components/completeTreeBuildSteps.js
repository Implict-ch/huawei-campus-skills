export const COMPLETE_TREE_BUILD_INPUT = [5, 3, 8, 2, 4];

export const COMPLETE_TREE_BUILD_PSEUDO = `def build(nums, idx):
    if idx >= len(nums):              # 越界 → 无节点
        return None
    node = Node(nums[idx])            # 创建当前节点
    node.left  = build(nums, 2*idx + 1)   # 递归左子树
    node.right = build(nums, 2*idx + 2)   # 递归右子树
    return node`;

export const PSEUDO_LINE = {
  DEF: 1,
  BOUND: 2,
  RETURN_NULL: 3,
  CREATE: 4,
  LEFT: 5,
  RIGHT: 6,
  RETURN_NODE: 7,
};

/**
 * @typedef {Object} CompleteTreeBuildVisual
 * @property {number[]} builtIndices 已挂接完成的节点下标（按 BFS 顺序）
 * @property {number | null} activeIdx 当前正在 build 的下标
 * @property {string} callLabel 如 build(0)
 * @property {number[]} leafIndices 已识别的叶子下标
 */

/** @type {CompleteTreeBuildVisual} */
export const INITIAL_VISUAL = {
  builtIndices: [],
  activeIdx: null,
  callLabel: "build(0)",
  leafIndices: [],
};

/** @param {Partial<CompleteTreeBuildVisual>} patch */
function vis(patch) {
  return { ...INITIAL_VISUAL, ...patch };
}

/**
 * @typedef {{ highlightLine: number, visual: CompleteTreeBuildVisual, caption: string }} CompleteTreeBuildStep
 */

/** @returns {CompleteTreeBuildStep[]} */
export function buildCompleteTreeBuildSteps() {
  /** @type {CompleteTreeBuildStep[]} */
  const steps = [];

  steps.push({
    highlightLine: PSEUDO_LINE.BOUND,
    visual: vis({ activeIdx: 0, callLabel: "build(0)" }),
    caption: "从根下标 0 开始：创建节点 5",
  });

  steps.push({
    highlightLine: PSEUDO_LINE.LEFT,
    visual: vis({ builtIndices: [0], activeIdx: 1, callLabel: "build(1)" }),
    caption: "递归左孩子 build(1)：挂接节点 3",
  });

  steps.push({
    highlightLine: PSEUDO_LINE.LEFT,
    visual: vis({ builtIndices: [0, 1], activeIdx: 3, callLabel: "build(3)" }),
    caption: "继续 build(3)、build(4)：左下叶子 2、4",
  });

  steps.push({
    highlightLine: PSEUDO_LINE.RETURN_NULL,
    visual: vis({
      builtIndices: [0, 1, 3, 4],
      activeIdx: null,
      callLabel: "idx ≥ n",
      leafIndices: [3, 4],
    }),
    caption: "build(5) 越界返回 null；节点 3 的左右子树完成",
  });

  steps.push({
    highlightLine: PSEUDO_LINE.RIGHT,
    visual: vis({ builtIndices: [0, 1, 3, 4], activeIdx: 2, callLabel: "build(2)" }),
    caption: "回到根，递归右孩子 build(2)：挂接节点 8",
  });

  steps.push({
    highlightLine: PSEUDO_LINE.RETURN_NODE,
    visual: vis({
      builtIndices: [0, 1, 2, 3, 4],
      activeIdx: null,
      callLabel: "完成",
      leafIndices: [3, 4, 2],
    }),
    caption: "build(5)、build(6) 越界；整棵树构建完成，叶子为 2、4、8",
  });

  return steps;
}

/** @param {number} step @param {CompleteTreeBuildStep[]} steps */
export function resolveCompleteTreeBuildHighlight(step, steps) {
  const line = steps[step]?.highlightLine ?? PSEUDO_LINE.DEF;
  return [line];
}

/** @param {number} step @param {CompleteTreeBuildStep[]} steps */
export function resolveCompleteTreeBuildVisual(step, steps) {
  return steps[step]?.visual ?? INITIAL_VISUAL;
}

/** @param {number} step @param {CompleteTreeBuildStep[]} steps */
export function resolveCompleteTreeBuildCaption(step, steps) {
  return steps[step]?.caption ?? "";
}

/** 样例 2 完全二叉树：各下标是否为叶子 */
export function isLeafIndex(idx, n) {
  const left = 2 * idx + 1;
  const right = 2 * idx + 2;
  return left >= n && right >= n;
}

export function leafIndicesForInput(nums) {
  const n = nums.length;
  /** @type {number[]} */
  const leaves = [];
  for (let i = 0; i < n; i++) {
    if (isLeafIndex(i, n)) leaves.push(i);
  }
  return leaves;
}
