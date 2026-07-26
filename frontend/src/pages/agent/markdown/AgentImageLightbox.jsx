import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { Icon } from "../../../icons/index.jsx";

/** 居中预览 + 背景虚化；多图可左右切换；Esc / 点空白关闭，+/- 只缩放图片 */
export default function AgentImageLightbox({ images, index = 0, onClose }) {
  const list = Array.isArray(images) && images.length ? images : [];
  const listKey = list.map((it) => it.src).join("\0");
  const [current, setCurrent] = useState(() =>
    Math.min(Math.max(0, index), Math.max(0, list.length - 1))
  );
  const [scale, setScale] = useState(1);
  const stageRef = useRef(null);
  const multi = list.length > 1;
  const item = list[current] || list[0];
  const src = item?.src || "";
  const alt = item?.alt || "";

  // 仅在打开灯箱或传入的图组变化时同步起始页；左右切换不要被重置
  useEffect(() => {
    setCurrent(Math.min(Math.max(0, index), Math.max(0, list.length - 1)));
    setScale(1);
  }, [index, listKey, list.length]);

  const bumpScale = useCallback((delta) => {
    setScale((s) => {
      const next = Math.round((s + delta) * 100) / 100;
      return Math.min(4, Math.max(0.4, next));
    });
  }, []);

  const go = useCallback(
    (delta) => {
      if (list.length <= 1) return;
      setCurrent((i) => (i + delta + list.length) % list.length);
      setScale(1);
    },
    [list.length]
  );

  const close = useCallback(() => {
    onClose?.();
  }, [onClose]);

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (e) => {
      const key = e.key;
      const code = e.code;
      if (key === "Escape" || code === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        close();
        return;
      }
      if (list.length > 1 && (key === "ArrowLeft" || code === "ArrowLeft")) {
        e.preventDefault();
        e.stopPropagation();
        go(-1);
        return;
      }
      if (list.length > 1 && (key === "ArrowRight" || code === "ArrowRight")) {
        e.preventDefault();
        e.stopPropagation();
        go(1);
        return;
      }
      // Cmd/Ctrl +/- 是浏览器页面缩放，灯箱打开时一律拦下并只缩放图片
      const zoomIn = key === "+" || key === "=" || code === "NumpadAdd";
      const zoomOut = key === "-" || key === "_" || code === "NumpadSubtract";
      const zoomReset = key === "0" || code === "Numpad0";
      if (zoomIn || zoomOut || zoomReset) {
        e.preventDefault();
        e.stopPropagation();
        if (zoomIn) bumpScale(0.25);
        else if (zoomOut) bumpScale(-0.25);
        else setScale(1);
      }
    };

    const onWheel = (e) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      bumpScale(e.deltaY < 0 ? 0.1 : -0.1);
    };

    window.addEventListener("keydown", onKey, true);
    document.addEventListener("keydown", onKey, true);
    window.addEventListener("wheel", onWheel, { passive: false, capture: true });
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey, true);
      document.removeEventListener("keydown", onKey, true);
      window.removeEventListener("wheel", onWheel, { capture: true });
    };
  }, [close, bumpScale, go, list.length]);

  if (!src) return null;

  return createPortal(
    <div
      className="agent-lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={alt || "图片预览"}
    >
      <div
        className="agent-lightbox__backdrop"
        onClick={close}
        aria-hidden="true"
      />
      {multi && (
        <button
          type="button"
          className="agent-lightbox__nav agent-lightbox__nav--prev"
          aria-label="上一张"
          onClick={(e) => {
            e.stopPropagation();
            go(-1);
          }}
        >
          <Icon name="arrow-left" size={22} color="currentColor" />
        </button>
      )}
      {multi && (
        <button
          type="button"
          className="agent-lightbox__nav agent-lightbox__nav--next"
          aria-label="下一张"
          onClick={(e) => {
            e.stopPropagation();
            go(1);
          }}
        >
          <Icon name="arrow-right" size={22} color="currentColor" />
        </button>
      )}
      {/* 点 stage 空白关闭；只有点到图片本身才 stopPropagation */}
      <div
        ref={stageRef}
        className="agent-lightbox__stage"
        onClick={close}
      >
        <div
          className="agent-lightbox__canvas"
          style={{ transform: `scale(${scale})` }}
          onClick={(e) => e.stopPropagation()}
        >
          <img
            key={src}
            src={src}
            alt={alt || ""}
            className="agent-lightbox__img"
            draggable={false}
          />
        </div>
      </div>
      <div className="agent-lightbox__hint">
        {multi ? (
          <>
            <span className="agent-lightbox__count">
              {current + 1} / {list.length}
            </span>
            · ← → 切换 ·{" "}
          </>
        ) : null}
        点击空白关闭 · Esc · +/- 缩放 · 0 重置
        <span className="agent-lightbox__scale">{Math.round(scale * 100)}%</span>
      </div>
    </div>,
    document.body
  );
}
