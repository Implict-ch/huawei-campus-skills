import { Icon } from "../icons/index.jsx";

export default function Complexity({ time, timeDesc, space, spaceDesc }) {
  return (
    <div className="complexity-grid">
      <div className="complexity-card">
        <div className="complexity-card__label">
          <Icon name="clock" size={14} color="var(--text-muted)" />
          时间复杂度
        </div>
        <div className="complexity-card__value">{time}</div>
        <div className="complexity-card__desc">{timeDesc}</div>
      </div>
      <div className="complexity-card">
        <div className="complexity-card__label">
          <Icon name="hard-drive" size={14} color="var(--text-muted)" />
          空间复杂度
        </div>
        <div className="complexity-card__value">{space}</div>
        <div className="complexity-card__desc">{spaceDesc}</div>
      </div>
    </div>
  );
}
