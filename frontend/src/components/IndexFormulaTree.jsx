import BinaryTreeSvg from "./BinaryTreeSvg.jsx";

/** 在边上标注 2×idx+1 / 2×idx+2 的索引关系树 */
export default function IndexFormulaTree() {
  return (
    <figure className="index-formula-tree" aria-label="完全二叉树数组下标与父子关系">
      <BinaryTreeSvg
        values={[0, 1, 2, 3, 4, 5, 6]}
        width={360}
        height={212}
        showIndex
        showValue={false}
        edgeFormulas
        ariaLabel="节点内为数组下标，连线上为左/右孩子下标公式"
      />
      <figcaption className="index-formula-tree__caption">
         <strong>数组为[0, 1, 2, 3, 4, 5, 6]</strong>
      </figcaption>
    </figure>
  );
}
