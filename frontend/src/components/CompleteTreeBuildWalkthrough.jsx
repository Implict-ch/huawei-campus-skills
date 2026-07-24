import { useMemo, useState } from "react";
import { Icon } from "../icons/index.jsx";
import CodeBlock from "./CodeBlock.jsx";
import CompleteTreeBuildCanvas from "./CompleteTreeBuildCanvas.jsx";
import WalkthroughPanel from "./WalkthroughPanel.jsx";
import {
  COMPLETE_TREE_BUILD_PSEUDO,
  buildCompleteTreeBuildSteps,
  resolveCompleteTreeBuildCaption,
  resolveCompleteTreeBuildHighlight,
  resolveCompleteTreeBuildVisual,
} from "./completeTreeBuildSteps.js";

export default function CompleteTreeBuildWalkthrough() {
  const steps = useMemo(() => buildCompleteTreeBuildSteps(), []);
  const [step, setStep] = useState(0);

  const highlightLines = resolveCompleteTreeBuildHighlight(step, steps);
  const visual = resolveCompleteTreeBuildVisual(step, steps);
  const caption = resolveCompleteTreeBuildCaption(step, steps);

  const atStart = step <= 0;
  const atEnd = step >= steps.length - 1;

  return (
    <WalkthroughPanel className="complete-tree-build-walk" ariaLabel="完全二叉树递归构建逐步演示" fitKey={step}>
      <div className="complete-tree-build-walk__layout">
        <p className="complete-tree-build-walk__panel-title complete-tree-build-walk__panel-title--code">
          伪代码
        </p>
        <p className="complete-tree-build-walk__panel-title complete-tree-build-walk__panel-title--visual">
          画布
        </p>

        <div className="complete-tree-build-walk__code-pane">
          <CodeBlock
            code={COMPLETE_TREE_BUILD_PSEUDO}
            lang="python"
            lineNumbers
            highlightLines={highlightLines}
            variant="compact"
          />
        </div>

        <div className="complete-tree-build-walk__visual-pane">
          <CompleteTreeBuildCanvas state={visual} />
        </div>
      </div>

      <p className="complete-tree-build-walk__caption">{caption}</p>

      <div className="complete-tree-build-walk__controls">
        <button
          type="button"
          className="complete-tree-build-walk__btn"
          disabled={atStart}
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          aria-label="上一步"
        >
          <Icon name="arrow-left" size={18} />
          上一步
        </button>
        <span className="complete-tree-build-walk__progress">
          {step + 1} / {steps.length}
        </span>
        <button
          type="button"
          className="complete-tree-build-walk__btn complete-tree-build-walk__btn--primary"
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
