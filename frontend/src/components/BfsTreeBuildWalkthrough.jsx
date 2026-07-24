import { useMemo, useState } from "react";
import { Icon } from "../icons/index.jsx";
import CodeBlock from "./CodeBlock.jsx";
import BfsTreeBuildCanvas from "./BfsTreeBuildCanvas.jsx";
import WalkthroughPanel from "./WalkthroughPanel.jsx";
import {
  BFS_TREE_BUILD_PSEUDO,
  buildBfsTreeBuildSteps,
  resolveBfsTreeBuildCaption,
  resolveBfsTreeBuildHighlight,
  resolveBfsTreeBuildVisual,
} from "./bfsTreeBuildSteps.js";

export default function BfsTreeBuildWalkthrough() {
  const steps = useMemo(() => buildBfsTreeBuildSteps(), []);
  const [step, setStep] = useState(0);

  const highlightLines = resolveBfsTreeBuildHighlight(step, steps);
  const visual = resolveBfsTreeBuildVisual(step, steps);
  const caption = resolveBfsTreeBuildCaption(step, steps);

  const atStart = step <= 0;
  const atEnd = step >= steps.length - 1;

  return (
    <WalkthroughPanel className="bfs-tree-build-walk" ariaLabel="BFS 层序构建二叉树逐步演示" fitKey={step}>
      <div className="bfs-tree-build-walk__layout">
        <p className="bfs-tree-build-walk__panel-title bfs-tree-build-walk__panel-title--code">
          伪代码
        </p>
        <p className="bfs-tree-build-walk__panel-title bfs-tree-build-walk__panel-title--visual">
          画布
        </p>

        <div className="bfs-tree-build-walk__code-pane">
          <CodeBlock
            code={BFS_TREE_BUILD_PSEUDO}
            lang="python"
            lineNumbers
            highlightLines={highlightLines}
            variant="compact"
          />
        </div>

        <div className="bfs-tree-build-walk__visual-pane">
          <BfsTreeBuildCanvas state={visual} />
        </div>
      </div>

      <p className="bfs-tree-build-walk__caption">{caption}</p>

      <div className="bfs-tree-build-walk__controls">
        <button
          type="button"
          className="bfs-tree-build-walk__btn"
          disabled={atStart}
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          aria-label="上一步"
        >
          <Icon name="arrow-left" size={18} />
          上一步
        </button>
        <span className="bfs-tree-build-walk__progress">
          {step + 1} / {steps.length}
        </span>
        <button
          type="button"
          className="bfs-tree-build-walk__btn bfs-tree-build-walk__btn--primary"
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
