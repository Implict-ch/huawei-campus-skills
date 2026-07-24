export const TAIL_INSERT_INPUT = [2, 7, 11, 15];

export const TAIL_INSERT_PSEUDO = `head = tail = None
for x in nums:
    node = new_node(x)
    if head is None:
        head = tail = node
    else:
        tail.next = node
        tail = node`;

export const PSEUDO_LINE = {
  INIT: 1,
  LOOP: 2,
  NEW_NODE: 3,
  IF_EMPTY: 4,
  SET_HEAD_TAIL: 5,
  ELSE: 6,
  LINK_TAIL: 7,
  MOVE_TAIL: 8,
};

/**
 * @typedef {'none' | 'dashed-null' | 'null-fade' | 'link-pending'} TailLinkMode
 */

/**
 * @typedef {'none' | 'commit-first' | 'spawn-node' | 'link-tail' | 'move-tail'} TailAnim
 */

/**
 * @typedef {Object} TailInsertVisual
 * @property {number[]} nodes
 * @property {number | null} pendingVal
 * @property {number} readIndex
 * @property {boolean} showHead
 * @property {boolean} showTail
 * @property {number | null} tailPtrIndex
 * @property {boolean} tailPtrSlide
 * @property {TailLinkMode} tailLink
 * @property {'solid' | 'dashed'} [linkStyle] 已入链节点之间的连线（虚线无箭头）
 * @property {TailAnim} [anim]
 */

/** @type {TailInsertVisual} */
export const INITIAL_VISUAL = {
  nodes: [],
  pendingVal: null,
  readIndex: -1,
  showHead: false,
  showTail: false,
  tailPtrIndex: null,
  tailPtrSlide: false,
  tailLink: "none",
  linkStyle: "solid",
  anim: "none",
};

/** @param {Partial<TailInsertVisual>} patch */
function vis(patch) {
  return { ...INITIAL_VISUAL, ...patch };
}

/** @param {number} len */
function nodes(len) {
  return TAIL_INSERT_INPUT.slice(0, len);
}

function withTailNull(base) {
  if (base.nodes.length === 0) return base;
  return { ...base, tailLink: "dashed-null" };
}

/**
 * @typedef {{ highlightLine: number, visual?: TailInsertVisual }} TailInsertStep
 */

/** @returns {TailInsertStep[]} */
export function buildTailInsertSteps() {
  /** @type {TailInsertStep[]} */
  const steps = [];
  const L = PSEUDO_LINE;

  const beat = (line, visual) => {
    steps.push(
      visual != null ? { highlightLine: line, visual } : { highlightLine: line },
    );
  };

  beat(L.INIT, vis({ tailLink: "none" }));

  for (let i = 0; i < TAIL_INSERT_INPUT.length; i++) {
    const x = TAIL_INSERT_INPUT[i];
    const prevLen = i;
    const prevNodes = nodes(prevLen);

    beat(
      L.LOOP,
      withTailNull(
        vis({
          nodes: prevNodes,
          pendingVal: null,
          readIndex: i,
          showHead: prevLen > 0,
          showTail: prevLen > 0,
          tailPtrIndex: prevLen > 0 ? prevLen - 1 : null,
        }),
      ),
    );

    beat(
      L.NEW_NODE,
      withTailNull(
        vis({
          nodes: prevNodes,
          pendingVal: x,
          readIndex: i,
          showHead: prevLen > 0,
          showTail: prevLen > 0,
          tailPtrIndex: prevLen > 0 ? prevLen - 1 : null,
          anim: "spawn-node",
        }),
      ),
    );

    if (i === 0) {
      beat(L.IF_EMPTY);

      beat(
        L.SET_HEAD_TAIL,
        vis({
          nodes: [x],
          pendingVal: null,
          readIndex: i,
          showHead: true,
          showTail: true,
          tailPtrIndex: 0,
          tailLink: "dashed-null",
          anim: "commit-first",
        }),
      );
      continue;
    }

    beat(L.ELSE);

    /* 单行 tail.next = node：null 淡出 → 虚线连向 pending → 入链（无箭头，不拆步） */
    beat(
      L.LINK_TAIL,
      vis({
        nodes: prevNodes,
        pendingVal: x,
        readIndex: i,
        showHead: true,
        showTail: true,
        tailPtrIndex: prevLen - 1,
        tailLink: "null-fade",
        anim: "link-tail",
      }),
    );

    /* tail = node：仅 tail 指针滑动；2—7 保持虚线无箭头 */
    beat(
      L.MOVE_TAIL,
      vis({
        nodes: nodes(i + 1),
        pendingVal: null,
        readIndex: i,
        showHead: true,
        showTail: true,
        tailPtrIndex: i,
        tailLink: "dashed-null",
        linkStyle: "dashed",
        anim: "move-tail",
      }),
    );
  }

  return steps;
}

/** @param {number} stepIndex @param {TailInsertStep[]} steps */
export function resolveTailInsertHighlight(stepIndex, steps) {
  return [steps[stepIndex]?.highlightLine ?? PSEUDO_LINE.INIT];
}

/** @param {number} stepIndex @param {TailInsertStep[]} steps */
export function resolveTailInsertVisual(stepIndex, steps) {
  let current = INITIAL_VISUAL;
  for (let i = 0; i <= stepIndex; i++) {
    if (steps[i].visual) current = steps[i].visual;
  }
  return current;
}
