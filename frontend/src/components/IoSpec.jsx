export default function IoSpec({ input, output }) {
  return (
    <div className="problem-io-spec">
      <div className="problem-io-spec__card">
        <div className="problem-io-spec__label">输入</div>
        <p className="problem-io-spec__text">{input}</p>
      </div>
      <div className="problem-io-spec__card">
        <div className="problem-io-spec__label">输出</div>
        <p className="problem-io-spec__text">{output}</p>
      </div>
    </div>
  );
}
