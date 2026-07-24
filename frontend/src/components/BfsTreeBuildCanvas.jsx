import { BfsBuiltTreeSvg } from "./BinaryTreeSvg.jsx";
import {
  buildBfsTreeFromArray,
  pruneBfsTreeBySourceIndices,
  findNodeIdBySourceIndex,
  findNodeIdByValue,
} from "./bfsTreeModel.js";
import { BFS_TREE_BUILD_INPUT } from "./bfsTreeBuildSteps.js";

const FULL_TREE = buildBfsTreeFromArray(BFS_TREE_BUILD_INPUT);

/**
 * @param {import('./bfsTreeBuildSteps.js').BfsTreeBuildVisual} state
 */
function resolveTreeVisual(state) {
  const { builtSourceIndices, readIndex, curVal, highlightSlot } = state;
  const built = builtSourceIndices ?? new Set();
  const root = pruneBfsTreeBySourceIndices(FULL_TREE, built);

  let highlightNodeId = null;
  if (
    highlightSlot != null &&
    BFS_TREE_BUILD_INPUT[highlightSlot] !== -1 &&
    built.has(highlightSlot)
  ) {
    highlightNodeId = findNodeIdBySourceIndex(FULL_TREE, highlightSlot);
  } else if (curVal != null && root) {
    highlightNodeId = findNodeIdByValue(root, curVal);
  }

  return { root, highlightNodeId };
}

/**
 * @param {{ state: import('./bfsTreeBuildSteps.js').BfsTreeBuildVisual }} props
 */
export default function BfsTreeBuildCanvas({ state }) {
  const { readIndex, queueVals, curVal, attachSide, highlightSlot } = state;
  const { root, highlightNodeId } = resolveTreeVisual(state);

  return (
    <div className="bfs-tree-build-canvas">
      <div className="bfs-tree-build-canvas__input-row">
        {BFS_TREE_BUILD_INPUT.map((v, i) => (
          <span
            key={`in-${i}`}
            className={`bfs-tree-build-canvas__cell${
              i === readIndex ? " bfs-tree-build-canvas__cell--active" : ""
            }${i < readIndex ? " bfs-tree-build-canvas__cell--done" : ""}${
              v === -1 ? " bfs-tree-build-canvas__cell--null" : ""
            }${i === highlightSlot ? " bfs-tree-build-canvas__cell--highlight" : ""}`}
          >
            <span className="bfs-tree-build-canvas__cell-idx">{i}</span>
            <span className="bfs-tree-build-canvas__cell-val">{v === -1 ? "-1" : v}</span>
          </span>
        ))}
      </div>

      <div className="bfs-tree-build-canvas__meta">
        <span className="bfs-tree-build-canvas__queue">
          队列：
          {queueVals.length > 0 ? (
            queueVals.map((v, i) => (
              <code key={`q-${i}-${v}`} className="bfs-tree-build-canvas__queue-item">
                {v}
              </code>
            ))
          ) : (
            <span className="bfs-tree-build-canvas__queue-empty">∅</span>
          )}
        </span>
        <span className="bfs-tree-build-canvas__cur">
          {curVal != null ? (
            <>
              当前 <code>{curVal}</code>
              {attachSide != null && (
                <span className="bfs-tree-build-canvas__attach">
                  → 挂{attachSide === "left" ? "左" : "右"}孩子
                </span>
              )}
            </>
          ) : (
            <>index = {readIndex}</>
          )}
        </span>
      </div>

      <div className="bfs-tree-build-canvas__stage">
        <BfsBuiltTreeSvg
          root={root}
          width={320}
          height={172}
          highlightNodeId={highlightNodeId}
          ariaLabel="BFS 构建过程中的二叉树"
        />
      </div>
    </div>
  );
}
