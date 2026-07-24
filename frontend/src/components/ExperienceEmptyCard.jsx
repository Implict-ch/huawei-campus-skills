/**
 * 未选择关键词时的空状态占位，样式对齐 ExperienceCard。
 */
export default function ExperienceEmptyCard() {
  return (
    <div className="experience-card experience-card--empty" aria-live="polite">
      <div className="experience-card__shine" />
      <div className="experience-card__head">
        <h3 className="experience-card__title">请选择关键词来筛选面经</h3>
        <span className="experience-card__date">筛选提示</span>
      </div>
      <p className="experience-card__empty-hint">
        右侧暂未选中任何关键词。勾选「包含内容 / 语言 / 技术栈」等标签后，左侧将按「或」逻辑展示匹配面经。
      </p>
    </div>
  );
}
