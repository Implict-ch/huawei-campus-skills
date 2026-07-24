import BinaryTreeSvg, { BfsBuiltTreeSvg } from "./BinaryTreeSvg.jsx";
import { buildBfsTreeFromArray } from "./bfsTreeModel.js";

function ArraySlot({ idx, val, variant = "default" }) {
  const isEmpty = val == null || val === -1;
  const displayVal = val === -1 ? "-1" : val == null ? "null" : val;
  return (
    <div
      className={`tree-array-slot tree-array-slot--${variant}${isEmpty ? " tree-array-slot--null" : ""}`}
      title={isEmpty ? "空位占位" : `下标 ${idx}`}
    >
      <span className="tree-array-slot__idx">{idx}</span>
      <span className="tree-array-slot__val">{displayVal}</span>
    </div>
  );
}

const SPARSE_ARRAY = [1, 2, 3, -1, 4, -1, 5, 6];
const SPARSE_TREE = buildBfsTreeFromArray(SPARSE_ARRAY);

/** 完全 vs 非完全：树形 + 数组映射对照 */
export default function TreeArrayMappingCompare() {
  const completeValues = [0, 1, 2, 3, 4, 5, 6, 7];

  return (
    <div className="tree-array-compare" aria-label="完全二叉树与非完全二叉树的数组存储对比">
      <section className="tree-array-compare__col tree-array-compare__col--ok">
        <h4 className="tree-array-compare__heading">完全二叉树 → 数组紧凑连续</h4>
        <BinaryTreeSvg
          values={completeValues}
          width={320}
          height={170}
          showIndex
          showValue={false}
          className="tree-array-compare__tree"
          ariaLabel="完全二叉树 8 个节点"
        />
        <div className="tree-array-compare__array-row">
          {completeValues.map((v, i) => (
            <ArraySlot key={`c-${i}`} idx={i} val={v} variant="ok" />
          ))}
        </div>
        <p className="tree-array-compare__hint">无空洞，下标与树结构一一对应。</p>
      </section>

      <section className="tree-array-compare__col tree-array-compare__col--bad">
        <h4 className="tree-array-compare__heading">普通二叉树 → 数组需 -1 占位</h4>
        <BfsBuiltTreeSvg
          root={SPARSE_TREE}
          width={320}
          height={170}
          className="tree-array-compare__tree"
          ariaLabel="普通二叉树 1 2 3 -1 4 -1 5 6 经 BFS 构建后的结构"
        />
        <div className="tree-array-compare__array-row">
          {SPARSE_ARRAY.map((v, i) => (
            <ArraySlot
              key={`s-${i}`}
              idx={i}
              val={v}
              variant={v === -1 ? "hole" : "bad"}
            />
          ))}
        </div>
        <p className="tree-array-compare__hint">
          中间有空洞，索引公式错乱。
        </p>
      </section>
    </div>
  );
}
