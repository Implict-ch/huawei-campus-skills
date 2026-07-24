import ListLinkEdge from "./ListLinkEdge.jsx";
import ListNullNode from "./ListNullNode.jsx";

const EDGE_W = 48;

/**
 * 静态链表示意（正文用）
 * @param {{ values: number[], headLabel?: string, tailLabel?: string }} props
 */
export default function LinkedListDiagram({
  values = [],
  headLabel = "head",
  tailLabel = "tail",
}) {
  const isEmpty = values.length === 0;

  return (
    <div className="linked-list-diagram linked-list-diagram--static" aria-hidden="true">
      {!isEmpty && (
        <div
          className="linked-list-diagram__ptr linked-list-diagram__ptr--head"
          style={{ left: 28 }}
        >
          <span className="linked-list-diagram__ptr-label">{headLabel}</span>
          <span className="linked-list-diagram__ptr-arrow">↓</span>
        </div>
      )}

      <div className="linked-list-diagram__chain">
        {isEmpty ? (
          <span className="linked-list-diagram__empty">null</span>
        ) : (
          values.map((val, i) => (
            <div key={`${val}-${i}`} className="linked-list-diagram__segment">
              <div
                className={`linked-list-node linked-list-node--canvas${
                  i === 0 ? " linked-list-node--head" : ""
                }${i === values.length - 1 ? " linked-list-node--tail" : ""}`}
              >
                <span className="linked-list-node__val">{val}</span>
                <span className="linked-list-node__next-label">next</span>
              </div>
              {i < values.length - 1 ? (
                <ListLinkEdge variant="solid" width={EDGE_W} />
              ) : (
                <>
                  <ListLinkEdge variant="dashed" width={EDGE_W} />
                  <ListNullNode />
                </>
              )}
            </div>
          ))
        )}
      </div>

      {!isEmpty && (
        <div
          className="linked-list-diagram__ptr linked-list-diagram__ptr--tail"
          style={{ left: (values.length - 1) * (56 + EDGE_W) + 28 }}
        >
          <span className="linked-list-diagram__ptr-arrow">↑</span>
          <span className="linked-list-diagram__ptr-label">{tailLabel}</span>
        </div>
      )}
    </div>
  );
}
