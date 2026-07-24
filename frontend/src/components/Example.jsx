function formatIo(value) {
  if (typeof value !== "string" || !value.includes("\n")) return value;
  const lines = value.split("\n");
  return lines.map((line, i) => (
    <span key={i}>
      {line}
      {i < lines.length - 1 ? <br /> : null}
    </span>
  ));
}

export default function Example({ title = "示例 1", input, output, explanation }) {
  return (
    <div className="problem-example">
      <div className="problem-example__title">{title}</div>
      <div className="problem-example__line problem-example__line--io">
        <span className="problem-example__label">输入：</span>
        <span className="problem-example__value">{formatIo(input)}</span>
      </div>
      <div className="problem-example__line problem-example__line--io">
        <span className="problem-example__label">输出：</span>
        <span className="problem-example__value">{formatIo(output)}</span>
      </div>
      {explanation && (
        <div className="problem-example__line">
          <span className="problem-example__label">解释：</span>
          {explanation}
        </div>
      )}
    </div>
  );
}
