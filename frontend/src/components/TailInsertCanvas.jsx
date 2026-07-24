import { useLayoutEffect, useRef, useState } from "react";
import ListLinkEdge from "./ListLinkEdge.jsx";
import ListNullNode from "./ListNullNode.jsx";
import LinkBridgeSvg from "./LinkBridgeSvg.jsx";

const NODE_W = 56;
const NODE_H = 52;
const EDGE_W = 32;
const PILL_STEP = 100;
const FIT_H = 184;
const STAGE_PAD_X = 24;

/** chain-area 顶部留白，给 head 标签 + 箭头 */
const CHAIN_PAD_TOP = 32;
/** 主链行垂直中心（相对 chain-area） */
const CHAIN_CY = CHAIN_PAD_TOP + 44;
/** 下方 pending 行顶部 */
const SPAWN_TOP = CHAIN_PAD_TOP + 88 + 8;
const SPAWN_CY = SPAWN_TOP + NODE_H / 2;

function ChainNode({ value, pending = false, isHead = false, isTail = false, popIn = false }) {
  return (
    <div
      className={`linked-list-node linked-list-node--canvas${
        pending ? " linked-list-node--new" : ""
      }${popIn ? " linked-list-node--pop-in" : ""}${
        isHead ? " linked-list-node--head" : ""
      }${isTail ? " linked-list-node--tail" : ""}`}
    >
      <span className="linked-list-node__val">{value}</span>
      <span className="linked-list-node__next-label">next</span>
    </div>
  );
}

/**
 * @param {import('./tailInsertSteps.js').TailInsertVisual} state
 */
function buildMainChainPlan(state) {
  const {
    nodes,
    pendingVal,
    showHead,
    showTail,
    tailLink,
    linkStyle = "solid",
    anim = "none",
  } = state;

  const plan = [];
  const showNullSuffix =
    tailLink === "dashed-null" || tailLink === "null-fade";
  const linkTailAnim = anim === "link-tail";

  const headVal = nodes[0] ?? (nodes.length === 0 ? pendingVal : null);
  if (headVal == null) return plan;

  const headPending = nodes.length === 0 && pendingVal != null;
  const spawnPop = anim === "spawn-node" && headPending;

  plan.push({
    key: `node-${headVal}`,
    node: {
      val: headVal,
      pending: headPending,
      isHead: showHead,
      isTail:
        showTail &&
        nodes.length <= 1 &&
        pendingVal == null &&
        !showNullSuffix,
      popIn: headPending && spawnPop,
    },
  });

  for (let i = 1; i < nodes.length; i++) {
    const val = nodes[i];
    plan.push({
      key: `edge-before-${val}`,
      edge: linkStyle === "dashed" ? "dashed" : "solid",
    });
    plan.push({
      key: `node-${val}`,
      node: {
        val,
        isTail:
          showTail &&
          i === nodes.length - 1 &&
          pendingVal == null &&
          !showNullSuffix,
      },
    });
  }

  if (nodes.length > 0 && showNullSuffix) {
    plan.push({
      key: "edge-before-null",
      edge: tailLink === "null-fade" ? "dashed-fade" : "dashed",
    });
    plan.push({
      key: "null-suffix",
      null: { fading: tailLink === "null-fade" && !linkTailAnim },
    });
  }

  return plan;
}

/** pending 在输入区下方：与当前高亮 pill 大致对齐 */
function spawnPadLeft(readIndex) {
  if (readIndex < 0) return 16;
  return 16 + readIndex * PILL_STEP;
}

/** 主链自然宽度（含 null 后缀与右侧指针留白） */
function measureChainWidth(nodes, showNullSuffix) {
  const n = nodes.length;
  if (n === 0) return NODE_W;
  let w = n * NODE_W + (n - 1) * EDGE_W;
  if (showNullSuffix) w += EDGE_W + NODE_W;
  return w + 20;
}

/** tail 节点右侧中点 → pending 左侧中点 */
function bridgeEndpoints(readIndex, tailPtrIndex) {
  const tailIdx = tailPtrIndex != null && tailPtrIndex >= 0 ? tailPtrIndex : 0;
  const x1 = tailIdx * (NODE_W + EDGE_W) + NODE_W;
  const y1 = CHAIN_CY;
  const x2 = spawnPadLeft(readIndex);
  const y2 = SPAWN_CY;
  return { x1, y1, x2, y2 };
}

/**
 * @param {{ state: import('./tailInsertSteps.js').TailInsertVisual, input: number[] }} props
 */
export default function TailInsertCanvas({ state, input }) {
  const {
    nodes,
    pendingVal,
    readIndex,
    showHead,
    showTail,
    tailPtrIndex,
    tailPtrSlide,
    anim = "none",
  } = state;

  const plan = buildMainChainPlan(state);
  const hasChain = plan.some((item) => item.node);
  const pendingBelow = pendingVal != null && nodes.length > 0;
  const showBridge = pendingBelow && anim === "link-tail";
  const spawnPop = anim === "spawn-node" && pendingBelow;
  const showNullSuffix =
    state.tailLink === "dashed-null" || state.tailLink === "null-fade";

  const bridge = showBridge ? bridgeEndpoints(readIndex, tailPtrIndex) : null;
  const naturalWidth = measureChainWidth(nodes, showNullSuffix);

  const stageRef = useRef(null);
  const [fitScale, setFitScale] = useState(1);

  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    const fit = () => {
      const available = stage.clientWidth - STAGE_PAD_X;
      if (available <= 0 || naturalWidth <= 0) return;
      setFitScale(Math.min(1, available / naturalWidth));
    };

    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(stage);
    return () => ro.disconnect();
  }, [naturalWidth]);

  const rootClass = [
    "tail-insert-canvas",
    anim === "commit-first" ? "tail-insert-canvas--commit-first" : "",
    anim === "spawn-node" ? "tail-insert-canvas--spawn-node" : "",
    anim === "link-tail" ? "tail-insert-canvas--link-tail" : "",
    anim === "move-tail" ? "tail-insert-canvas--move-tail" : "",
    pendingBelow ? " tail-insert-canvas--has-spawn" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const tailPtrLeft =
    tailPtrIndex != null && tailPtrIndex >= 0
      ? tailPtrIndex * (NODE_W + EDGE_W) + NODE_W / 2
      : NODE_W / 2;

  const scaled = fitScale < 1;

  return (
    <div className={rootClass}>
      <div className="tail-insert-canvas__input-row">
        {input.map((v, i) => (
          <span
            key={`in-${i}`}
            className={`tail-insert-canvas__pill${
              i === readIndex ? " tail-insert-canvas__pill--active" : ""
            }${i < readIndex ? " tail-insert-canvas__pill--done" : ""}`}
          >
            {v}
          </span>
        ))}
      </div>

      <div className="tail-insert-canvas__stage" ref={stageRef}>
        <div
          className="tail-insert-canvas__fit-wrap"
          style={{ height: scaled ? FIT_H * fitScale : FIT_H }}
        >
          <div
            className="tail-insert-canvas__fit"
            style={{
              width: naturalWidth,
              height: FIT_H,
              transform: scaled ? `scale(${fitScale})` : undefined,
            }}
          >
            {showHead && hasChain && (
              <div
                className="tail-insert-canvas__ptr tail-insert-canvas__ptr--head"
                style={{ left: NODE_W / 2 }}
              >
                <span className="tail-insert-canvas__ptr-label">head</span>
                <span className="tail-insert-canvas__ptr-arrow">↓</span>
              </div>
            )}

            <div className="tail-insert-canvas__chain-area">
              {showBridge && bridge && (
                <LinkBridgeSvg
                  x1={bridge.x1}
                  y1={bridge.y1}
                  x2={bridge.x2}
                  y2={bridge.y2}
                  viewW={naturalWidth}
                  viewH={FIT_H}
                  animate
                />
              )}

              <div className="tail-insert-canvas__chain-row">
                {!hasChain && pendingVal == null && (
                  <span className="tail-insert-canvas__empty">∅ 空链表</span>
                )}

                {plan.map((item) => {
                  if (item.edge) {
                    const edgeVariant =
                      anim === "commit-first" && item.key === "edge-before-null"
                        ? "dashed-draw"
                        : item.edge;
                    const extraClass =
                      anim === "commit-first" && item.key === "edge-before-null"
                        ? "list-link-edge--commit-draw"
                        : anim === "link-tail" && item.key === "edge-before-null"
                          ? "list-link-edge--link-tail-fade"
                          : "";
                    return (
                      <ListLinkEdge
                        key={item.key}
                        variant={edgeVariant}
                        width={EDGE_W}
                        className={extraClass}
                      />
                    );
                  }
                  if (item.null) {
                    return (
                      <ListNullNode key={item.key} fading={item.null.fading} />
                    );
                  }
                  if (item.node) {
                    const n = item.node;
                    return (
                      <div key={item.key} className="tail-insert-canvas__segment">
                        <ChainNode
                          value={n.val}
                          pending={n.pending}
                          isHead={n.isHead}
                          isTail={n.isTail}
                          popIn={n.popIn}
                        />
                      </div>
                    );
                  }
                  return null;
                })}
              </div>

              {pendingBelow && (
                <div
                  className="tail-insert-canvas__spawn-row"
                  style={{ paddingLeft: spawnPadLeft(readIndex) }}
                >
                  <ChainNode value={pendingVal} pending popIn={spawnPop} />
                </div>
              )}
            </div>

            {showTail && tailPtrIndex != null && tailPtrIndex >= 0 && (
              <div
                className={`tail-insert-canvas__ptr tail-insert-canvas__ptr--tail${
                  tailPtrSlide ? " tail-insert-canvas__ptr--slide" : ""
                }`}
                style={{ left: tailPtrLeft }}
              >
                <span className="tail-insert-canvas__ptr-arrow">↑</span>
                <span className="tail-insert-canvas__ptr-label">tail</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
