import { Icon } from "../icons/index.jsx";

export default function InteractiveDemo({
  title,
  children,
  step = null,
  totalSteps = null,
  onPrev,
  onNext,
  onPlay,
  playing = false,
  canPrev = true,
  canNext = true,
}) {
  const showControls = totalSteps != null;

  return (
    <div className="interactive-demo">
      <div className="interactive-demo__shine" />
      {(title || showControls) && (
        <div className="interactive-demo__header">
          {title && (
            <div className="interactive-demo__title">
              <Icon name="monitor-play" size={16} color="var(--accent)" />
              {title}
            </div>
          )}
          {showControls && (
            <div className="interactive-demo__controls">
              <button
                type="button"
                className="interactive-demo__btn"
                onClick={onPrev}
                disabled={!canPrev}
                aria-label="上一步"
              >
                <Icon name="skip-back" size={14} />
              </button>
              <button
                type="button"
                className={`interactive-demo__btn${playing ? " interactive-demo__btn--active" : ""}`}
                onClick={onPlay}
                aria-label={playing ? "暂停" : "播放"}
              >
                <Icon name={playing ? "pause" : "play"} size={14} />
              </button>
              <button
                type="button"
                className="interactive-demo__btn"
                onClick={onNext}
                disabled={!canNext}
                aria-label="下一步"
              >
                <Icon name="skip-forward" size={14} />
              </button>
              <span className="interactive-demo__steps">
                {step}/{totalSteps}
              </span>
            </div>
          )}
        </div>
      )}
      <div className="interactive-demo__canvas">{children}</div>
    </div>
  );
}
