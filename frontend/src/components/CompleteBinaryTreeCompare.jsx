import BinaryTreeSvg, { SparseBinaryTreeSvg } from "./BinaryTreeSvg.jsx";
import { Icon } from "../icons/index.jsx";

/** 完全二叉树 vs 非完全二叉树 并排对比 */
export default function CompleteBinaryTreeCompare() {
  return (
    <div className="tree-compare-pair" aria-label="完全二叉树与非完全二叉树对比">
      <figure className="tree-compare-pair__panel tree-compare-pair__panel--ok">
        <figcaption className="tree-compare-pair__badge tree-compare-pair__badge--ok">
          <Icon name="check" size={14} />
          完全二叉树
        </figcaption>
        <BinaryTreeSvg
          values={[1, 2, 3, 4, 5, 6, 7]}
          width={300}
          height={190}
          showValue
          ariaLabel="完全二叉树：最后一层节点从左到右连续"
        />
        <p className="tree-compare-pair__note">
          是一颗完全二叉树
        </p>
      </figure>

      <figure className="tree-compare-pair__panel tree-compare-pair__panel--bad">
        <figcaption className="tree-compare-pair__badge tree-compare-pair__badge--bad">
          <Icon name="alert-triangle" size={14} />
          非完全二叉树
        </figcaption>
        <SparseBinaryTreeSvg
          slots={[0, 1, 2, 3, null, null, 6]}
          width={300}
          height={190}
          showIndex={false}
          ariaLabel="非完全二叉树：层序存储时中间需留空"
        />
        <p className="tree-compare-pair__note">
          节点 1 的右儿子、节点 2 的 左儿子 位置空缺。
        </p>
      </figure>
    </div>
  );
}
