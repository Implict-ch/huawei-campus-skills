import { useMemo, useState } from "react";
import { Icon } from "../icons/index.jsx";
import CodeBlock from "./CodeBlock.jsx";
import TailInsertCanvas from "./TailInsertCanvas.jsx";
import WalkthroughPanel from "./WalkthroughPanel.jsx";
import {
  TAIL_INSERT_INPUT,
  TAIL_INSERT_PSEUDO,
  buildTailInsertSteps,
  resolveTailInsertHighlight,
  resolveTailInsertVisual,
} from "./tailInsertSteps.js";

export default function TailInsertWalkthrough() {
  const steps = useMemo(() => buildTailInsertSteps(), []);
  const [step, setStep] = useState(0);

  const highlightLines = resolveTailInsertHighlight(step, steps);
  const visual = resolveTailInsertVisual(step, steps);

  const atStart = step <= 0;
  const atEnd = step >= steps.length - 1;

  return (
    <WalkthroughPanel className="tail-insert-walk" ariaLabel="尾插法逐步演示" fitKey={step}>
      <div className="tail-insert-walk__layout">
        <p className="tail-insert-walk__panel-title tail-insert-walk__panel-title--code">
          伪代码
        </p>
        <p className="tail-insert-walk__panel-title tail-insert-walk__panel-title--visual">
          画布
        </p>

        <div className="tail-insert-walk__code-pane">
          <CodeBlock
            code={TAIL_INSERT_PSEUDO}
            lang="python"
            lineNumbers
            highlightLines={highlightLines}
            variant="compact"
          />
        </div>

        <div className="tail-insert-walk__visual-pane">
          <TailInsertCanvas state={visual} input={TAIL_INSERT_INPUT} />
        </div>
      </div>

      <div className="tail-insert-walk__controls">
        <button
          type="button"
          className="tail-insert-walk__btn"
          disabled={atStart}
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          aria-label="上一步"
        >
          <Icon name="arrow-left" size={18} />
          上一步
        </button>
        <span className="tail-insert-walk__progress">
          {step + 1} / {steps.length}
        </span>
        <button
          type="button"
          className="tail-insert-walk__btn tail-insert-walk__btn--primary"
          disabled={atEnd}
          onClick={() => setStep((s) => Math.min(steps.length - 1, s + 1))}
          aria-label="下一步"
        >
          下一步
          <Icon name="arrow" size={18} />
        </button>
      </div>
    </WalkthroughPanel>
  );
}
