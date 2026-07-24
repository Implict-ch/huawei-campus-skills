import { useState } from "react";
import { Icon } from "../icons/index.jsx";

export default function QA({ question, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={`qa-card${open ? " qa-card--open" : ""}`}>
      <button
        type="button"
        className="qa-card__question"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="qa-card__question-text">
          <span className="qa-card__prefix qa-card__prefix--q">Q</span>
          {question}
        </span>
        <Icon
          name="chevron-down"
          size={18}
          color="var(--text-muted)"
          className="qa-card__chevron"
        />
      </button>
      <div className="qa-card__answer-wrap">
        <div className="qa-card__answer">
          <span className="qa-card__prefix qa-card__prefix--a">A</span>
          <div className="qa-card__answer-body">{children}</div>
        </div>
      </div>
    </div>
  );
}
