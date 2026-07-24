import { Icon } from "../icons/index.jsx";

/** 本篇 / 下篇 对比预告卡片 */
export default function BinaryTreeSeriesPreview() {
  return (
    <div className="tree-series-preview" aria-label="二叉树构建方法系列预告">
      <div className="tree-series-preview__col tree-series-preview__col--current">
        <span className="tree-series-preview__tag">本篇</span>
        <h4 className="tree-series-preview__title">完全二叉树</h4>
        <p className="tree-series-preview__desc">
          数组紧凑存储，<strong>下标直接算</strong>父子关系，递归 <code>build(2×idx+1)</code> 即可。
        </p>
      </div>

      <div className="tree-series-preview__arrow" aria-hidden="true">
        <Icon name="arrow" size={22} />
      </div>

      <div className="tree-series-preview__col tree-series-preview__col--next">
        <span className="tree-series-preview__tag tree-series-preview__tag--next">下篇</span>
        <h4 className="tree-series-preview__title">普通二叉树</h4>
        <p className="tree-series-preview__desc">
          数组含 <code>null</code> 占位，需用<strong>层序遍历</strong>逐层构建，不能靠下标公式硬推。
        </p>
      </div>
    </div>
  );
}
