import BinaryTreeSvg from "./BinaryTreeSvg.jsx";
import {
  COMPLETE_TREE_BUILD_INPUT,
  leafIndicesForInput,
} from "./completeTreeBuildSteps.js";

/**
 * @param {{ state: import('./completeTreeBuildSteps.js').CompleteTreeBuildVisual }} props
 */
export default function CompleteTreeBuildCanvas({ state }) {
  const { builtIndices, activeIdx, callLabel, leafIndices } = state;
  const builtSet = new Set(builtIndices);

  /** @type {Record<number, 'default' | 'active' | 'done' | 'dim' | 'leaf'>} */
  const nodeVariants = {};
  for (let i = 0; i < COMPLETE_TREE_BUILD_INPUT.length; i++) {
    if (activeIdx === i) {
      nodeVariants[i] = "active";
    } else if (builtSet.has(i)) {
      nodeVariants[i] = leafIndices.includes(i) ? "leaf" : "done";
    } else {
      nodeVariants[i] = "dim";
    }
  }

  const staticLeaves = leafIndicesForInput(COMPLETE_TREE_BUILD_INPUT);

  return (
    <div className="complete-tree-build-canvas">
      <div className="complete-tree-build-canvas__input-row">
        {COMPLETE_TREE_BUILD_INPUT.map((v, i) => (
          <span
            key={`in-${i}`}
            className={`complete-tree-build-canvas__pill${
              activeIdx === i ? " complete-tree-build-canvas__pill--active" : ""
            }${builtSet.has(i) && activeIdx !== i ? " complete-tree-build-canvas__pill--done" : ""}`}
          >
            <span className="complete-tree-build-canvas__pill-idx">{i}</span>
            <span className="complete-tree-build-canvas__pill-val">{v}</span>
          </span>
        ))}
      </div>

      <div className="complete-tree-build-canvas__stage">
        <div className="complete-tree-build-canvas__call">
          当前调用：<code>{callLabel}</code>
        </div>
        <BinaryTreeSvg
          values={COMPLETE_TREE_BUILD_INPUT}
          width={320}
          height={168}
          showValue
          nodeVariants={nodeVariants}
          ariaLabel="递归构建完全二叉树过程"
        />
        <div className="complete-tree-build-canvas__legend">
          <span className="complete-tree-build-canvas__legend-item complete-tree-build-canvas__legend-item--active">
            正在创建
          </span>
          <span className="complete-tree-build-canvas__legend-item complete-tree-build-canvas__legend-item--done">
            已挂接
          </span>
          <span className="complete-tree-build-canvas__legend-item complete-tree-build-canvas__legend-item--leaf">
            叶子（最终 {staticLeaves.map((i) => COMPLETE_TREE_BUILD_INPUT[i]).join("、")}）
          </span>
        </div>
      </div>
    </div>
  );
}
