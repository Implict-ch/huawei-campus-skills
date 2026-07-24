/**
 * 尾部的 null 占位：与数据节点同高的 div，仅样式为 null 字样
 * @param {{ fading?: boolean, popIn?: boolean }} props
 */
export default function ListNullNode({ fading = false, popIn = false }) {
  return (
    <div
      className={`list-null-node linked-list-node--canvas${
        fading ? " list-null-node--fade" : ""
      }${popIn ? " list-null-node--pop-in" : ""}`}
      aria-hidden="true"
    >
      <span className="list-null-node__label">null</span>
    </div>
  );
}
