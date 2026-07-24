/**
 * 数据范围对比（系列递进题：突出相对上一题的变化）
 */
export default function DataRangeDiff({
  prevLabel = "第一题",
  prevValue,
  currentLabel = "本题",
  currentValue,
  changeLabel = "范围扩大",
}) {
  return (
    <div className="problem-data-range-diff">
      <span className="problem-data-range-diff__heading">数据范围</span>
      <div className="problem-data-range-diff__rows">
        <div className="problem-data-range-diff__row problem-data-range-diff__row--prev">
          <span className="problem-data-range-diff__tag">{prevLabel}</span>
          <span className="problem-data-range-diff__value">{prevValue}</span>
        </div>
        <div className="problem-data-range-diff__row problem-data-range-diff__row--current">
          <span className="problem-data-range-diff__tag">{currentLabel}</span>
          <span className="problem-data-range-diff__value">{currentValue}</span>
          {changeLabel ? (
            <span className="problem-data-range-diff__badge">{changeLabel}</span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
