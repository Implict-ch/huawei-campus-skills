import Example from "../../components/Example.jsx";
import CodeTabs from "../../components/CodeTabs.jsx";
import CodeBlock from "../../components/CodeBlock.jsx";
import Complexity from "../../components/Complexity.jsx";
import QA from "../../components/QA.jsx";
import InteractiveDemo from "../../components/InteractiveDemo.jsx";
import IoSpec from "../../components/IoSpec.jsx";
import DataRange from "../../components/DataRange.jsx";
import Callout from "../../components/Callout.jsx";
import DataRangeDiff from "../../components/DataRangeDiff.jsx";
import LangCompare from "../../components/LangCompare.jsx";
import Math from "../../components/Math.jsx";
import IoRule, { IoRuleList } from "../../components/IoRuleList.jsx";
import FlowSteps, { FlowStep } from "../../components/FlowSteps.jsx";
import ProgressPath from "../../components/ProgressPath.jsx";
import TermCard from "../../components/TermCard.jsx";
import Checklist from "../../components/Checklist.jsx";
import EofIllustration from "../../components/EofIllustration.jsx";
import LinkedListDiagram from "../../components/LinkedListDiagram.jsx";
import TailInsertWalkthrough from "../../components/TailInsertWalkthrough.jsx";
import CompleteBinaryTreeCompare from "../../components/CompleteBinaryTreeCompare.jsx";
import IndexFormulaTree from "../../components/IndexFormulaTree.jsx";
import TreeArrayMappingCompare from "../../components/TreeArrayMappingCompare.jsx";
import CompleteTreeBuildWalkthrough from "../../components/CompleteTreeBuildWalkthrough.jsx";
import BfsTreeBuildWalkthrough from "../../components/BfsTreeBuildWalkthrough.jsx";
import LevelOrderTreeExample from "../../components/LevelOrderTreeExample.jsx";
import BinaryTreeSeriesPreview from "../../components/BinaryTreeSeriesPreview.jsx";

export function ProseWrapper({ children }) {
  return <article className="problem-prose">{children}</article>;
}

/** MDX 正文块：勿用多行 <p>（会嵌套 <p> 导致 hydration 报错） */
export function Text({ children }) {
  return <div className="problem-text">{children}</div>;
}

export function QAList({ children }) {
  return <div className="qa-list">{children}</div>;
}

export const articleComponents = {
  Example,
  CodeTabs,
  CodeBlock,
  Complexity,
  QA,
  QAList,
  InteractiveDemo,
  IoSpec,
  DataRange,
  DataRangeDiff,
  LangCompare,
  Math,
  Callout,
  IoRule,
  IoRuleList,
  FlowSteps,
  FlowStep,
  ProgressPath,
  TermCard,
  Checklist,
  EofIllustration,
  LinkedListDiagram,
  TailInsertWalkthrough,
  CompleteBinaryTreeCompare,
  IndexFormulaTree,
  TreeArrayMappingCompare,
  CompleteTreeBuildWalkthrough,
  BfsTreeBuildWalkthrough,
  LevelOrderTreeExample,
  BinaryTreeSeriesPreview,
};
