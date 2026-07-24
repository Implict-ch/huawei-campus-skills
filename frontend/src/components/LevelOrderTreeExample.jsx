import { BfsBuiltTreeSvg } from "./BinaryTreeSvg.jsx";
import { buildBfsTreeFromArray } from "./bfsTreeModel.js";

const EXAMPLE_ARRAY = [1, 2, 3, -1, 4, -1, 5, 6];
const EXAMPLE_TREE = buildBfsTreeFromArray(EXAMPLE_ARRAY);

/** 层序数组 [1,2,3,-1,4,-1,5,6] → 二叉树 静态示意 */
export default function LevelOrderTreeExample() {
  return (
    <figure className="level-order-tree-example" aria-label="层序数组构建普通二叉树示例">
      <div className="level-order-tree-example__array-row">
        {EXAMPLE_ARRAY.map((v, i) => (
          <div
            key={`ex-${i}`}
            className={`level-order-tree-example__cell${
              v === -1 ? " level-order-tree-example__cell--null" : ""
            }`}
          >
            <span className="level-order-tree-example__cell-idx">{i}</span>
            <span className="level-order-tree-example__cell-val">{v === -1 ? "-1" : v}</span>
          </div>
        ))}
      </div>
      <div className="level-order-tree-example__arrow" aria-hidden="true">
        ↓
      </div>
      <BfsBuiltTreeSvg
        root={EXAMPLE_TREE}
        width={340}
        height={190}
        className="level-order-tree-example__tree"
        ariaLabel="数组 1 2 3 -1 4 -1 5 6 对应的二叉树"
      />
      <figcaption className="level-order-tree-example__caption">
        <code>-1</code> 表示空节点占位；BFS 按顺序为非空节点分配左右孩子，跳过空位但不继续向下扩展。
      </figcaption>
    </figure>
  );
}
