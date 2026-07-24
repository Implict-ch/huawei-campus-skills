export const BFS_TREE_BUILD_INPUT = [1, 2, 3, -1, 4, -1, 5, 6];

export const BFS_TREE_BUILD_PSEUDO = `root = TreeNode(nums[0])
queue = deque([root])
index = 1
while queue and index < len(nums):
    cur = queue.popleft()
    if index < len(nums):
        if nums[index] != -1:           # 左孩子非空
            cur.left = TreeNode(nums[index])
            queue.append(cur.left)
        index += 1
    if index < len(nums):
        if nums[index] != -1:           # 右孩子非空
            cur.right = TreeNode(nums[index])
            queue.append(cur.right)
        index += 1`;

export const PSEUDO_LINE = {
  ROOT: 1,
  QUEUE_INIT: 2,
  INDEX_INIT: 3,
  WHILE: 4,
  DEQUEUE: 5,
  LEFT_BOUND: 6,
  LEFT_CREATE: 7,
  LEFT_APPEND: 8,
  LEFT_INDEX: 9,
  RIGHT_BOUND: 10,
  RIGHT_CREATE: 11,
  RIGHT_APPEND: 12,
  RIGHT_INDEX: 13,
};

/**
 * @typedef {Object} BfsTreeBuildVisual
 * @property {Set<number>} builtSourceIndices 已创建节点对应的 nums 下标
 * @property {number} readIndex 当前读到的数组下标
 * @property {number[]} queueVals 队列中节点值
 * @property {number | null} curVal 当前处理的节点值
 * @property {number | null} highlightSlot 高亮数组下标
 * @property {'left' | 'right' | null} attachSide 正在挂接左/右孩子
 */

/** @returns {{ highlightLine: number, visual: BfsTreeBuildVisual, caption: string }[]} */
export function buildBfsTreeBuildSteps() {
  /** @type {{ highlightLine: number, visual: BfsTreeBuildVisual, caption: string }[]} */
  const steps = [];

  /** @param {Partial<BfsTreeBuildVisual>} v */
  function push(highlightLine, caption, v) {
    steps.push({ highlightLine, caption, visual: v });
  }

  push(PSEUDO_LINE.ROOT, "读入数组，创建根节点 1，index = 1", {
    builtSourceIndices: new Set([0]),
    readIndex: 1,
    queueVals: [1],
    curVal: null,
    highlightSlot: 0,
    attachSide: null,
  });

  push(PSEUDO_LINE.DEQUEUE, "出队 cur = 1，准备分配左右孩子", {
    builtSourceIndices: new Set([0]),
    readIndex: 1,
    queueVals: [],
    curVal: 1,
    highlightSlot: 0,
    attachSide: null,
  });

  push(PSEUDO_LINE.LEFT_CREATE, "nums[1] = 2，挂为 1 的左孩子并入队", {
    builtSourceIndices: new Set([0, 1]),
    readIndex: 2,
    queueVals: [2],
    curVal: 1,
    highlightSlot: 1,
    attachSide: "left",
  });

  push(PSEUDO_LINE.RIGHT_CREATE, "nums[2] = 3，挂为 1 的右孩子并入队", {
    builtSourceIndices: new Set([0, 1, 2]),
    readIndex: 3,
    queueVals: [2, 3],
    curVal: 1,
    highlightSlot: 2,
    attachSide: "right",
  });

  push(PSEUDO_LINE.DEQUEUE, "出队 cur = 2，nums[3] = -1，左孩子为空，仅 index++", {
    builtSourceIndices: new Set([0, 1, 2]),
    readIndex: 4,
    queueVals: [3],
    curVal: 2,
    highlightSlot: 3,
    attachSide: null,
  });

  push(PSEUDO_LINE.RIGHT_CREATE, "nums[4] = 4，挂为 2 的右孩子并入队", {
    builtSourceIndices: new Set([0, 1, 2, 4]),
    readIndex: 5,
    queueVals: [3, 4],
    curVal: 2,
    highlightSlot: 4,
    attachSide: "right",
  });

  push(PSEUDO_LINE.DEQUEUE, "出队 cur = 3，nums[5] = -1，左孩子为空", {
    builtSourceIndices: new Set([0, 1, 2, 4]),
    readIndex: 6,
    queueVals: [4],
    curVal: 3,
    highlightSlot: 5,
    attachSide: null,
  });

  push(PSEUDO_LINE.RIGHT_CREATE, "nums[6] = 5，挂为 3 的右孩子并入队", {
    builtSourceIndices: new Set([0, 1, 2, 4, 6]),
    readIndex: 7,
    queueVals: [4, 5],
    curVal: 3,
    highlightSlot: 6,
    attachSide: "right",
  });

  push(PSEUDO_LINE.LEFT_CREATE, "出队 cur = 4，nums[7] = 6，挂为左孩子", {
    builtSourceIndices: new Set([0, 1, 2, 4, 6, 7]),
    readIndex: 8,
    queueVals: [5, 6],
    curVal: 4,
    highlightSlot: 7,
    attachSide: "left",
  });

  push(PSEUDO_LINE.WHILE, "队列剩余节点无新孩子可读，构建完成", {
    builtSourceIndices: new Set([0, 1, 2, 4, 6, 7]),
    readIndex: 8,
    queueVals: [],
    curVal: null,
    highlightSlot: null,
    attachSide: null,
  });

  return steps;
}

/** @param {number} step @param {ReturnType<typeof buildBfsTreeBuildSteps>} steps */
export function resolveBfsTreeBuildHighlight(step, steps) {
  return [steps[step]?.highlightLine ?? PSEUDO_LINE.ROOT];
}

/** @param {number} step @param {ReturnType<typeof buildBfsTreeBuildSteps>} steps */
export function resolveBfsTreeBuildVisual(step, steps) {
  return steps[step]?.visual ?? buildBfsTreeBuildSteps()[0].visual;
}

/** @param {number} step @param {ReturnType<typeof buildBfsTreeBuildSteps>} steps */
export function resolveBfsTreeBuildCaption(step, steps) {
  return steps[step]?.caption ?? "";
}
