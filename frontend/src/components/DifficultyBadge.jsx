import { DIFFICULTY_LABELS } from "../content/difficulty.js";

export default function DifficultyBadge({ difficulty }) {
  const diff = DIFFICULTY_LABELS[difficulty];
  if (!diff) return null;

  return (
    <span className={`difficulty-badge difficulty-badge--${difficulty}`}>
      {diff.text}
    </span>
  );
}
