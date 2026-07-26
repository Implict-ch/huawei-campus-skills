import { useRef, useLayoutEffect } from "react";

/**
 * 流式输出时丝滑增高：锁定外层高度，向内容真实高度做短过渡，避免 markdown 块级元素断点式突跳。
 */
export default function SmoothGrowBox({ active, onGrow, className, children }) {
  const outerRef = useRef(null);
  const innerRef = useRef(null);
  const heightRef = useRef(null);
  const followRafRef = useRef(0);
  const onGrowRef = useRef(onGrow);
  onGrowRef.current = onGrow;

  useLayoutEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return undefined;

    if (!active) {
      outer.style.height = "";
      outer.style.overflow = "";
      outer.style.transition = "";
      heightRef.current = null;
      return undefined;
    }

    outer.style.overflow = "hidden";

    const followDuringTween = () => {
      cancelAnimationFrame(followRafRef.current);
      const start = performance.now();
      const step = () => {
        onGrowRef.current?.();
        if (performance.now() - start < 220) {
          followRafRef.current = requestAnimationFrame(step);
        }
      };
      followRafRef.current = requestAnimationFrame(step);
    };

    const sync = (animate) => {
      const targetH = Math.ceil(Math.max(inner.scrollHeight, inner.getBoundingClientRect().height));
      if (targetH <= 0) return;
      const prev = heightRef.current;

      if (prev == null || !animate) {
        outer.style.transition = "none";
        outer.style.height = `${targetH}px`;
        heightRef.current = targetH;
        return;
      }
      if (targetH === prev) return;

      // 从当前视觉高度接着 tween，避免每帧硬跳
      const visual = outer.getBoundingClientRect().height;
      outer.style.transition = "none";
      outer.style.height = `${visual}px`;
      // force reflow
      void outer.offsetHeight;
      outer.style.transition = "height 170ms ease-out";
      outer.style.height = `${targetH}px`;
      heightRef.current = targetH;
      followDuringTween();
    };

    sync(false);
    let scheduled = false;
    const ro = new ResizeObserver(() => {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(() => {
        scheduled = false;
        sync(true);
      });
    });
    ro.observe(inner);

    return () => {
      ro.disconnect();
      cancelAnimationFrame(followRafRef.current);
    };
  }, [active]);

  // 内容变更时（同一 active 会话内）也触发一次测量；RO 负责后续
  useLayoutEffect(() => {
    if (!active) return;
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;
    const targetH = Math.ceil(Math.max(inner.scrollHeight, inner.getBoundingClientRect().height));
    if (targetH <= 0) return;
    const prev = heightRef.current;
    if (prev == null) {
      outer.style.transition = "none";
      outer.style.height = `${targetH}px`;
      heightRef.current = targetH;
      return;
    }
    if (targetH === prev) return;
    const visual = outer.getBoundingClientRect().height;
    outer.style.transition = "none";
    outer.style.height = `${visual}px`;
    void outer.offsetHeight;
    outer.style.transition = "height 170ms ease-out";
    outer.style.height = `${targetH}px`;
    heightRef.current = targetH;
    onGrowRef.current?.();
  }, [active, children]);

  return (
    <div ref={outerRef} className={className}>
      <div ref={innerRef} className="agent-message__body-measure">
        {children}
      </div>
    </div>
  );
}
