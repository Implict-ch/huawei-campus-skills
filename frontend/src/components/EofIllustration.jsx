/** EOF 示意：终端窗口 + 骨架行 + 末尾高亮 /0 */
export default function EofIllustration() {
  return (
    <figure className="problem-eof-illustration" aria-label="输入流末尾的 EOF 示意：文件以 /0 结束">
      <svg
        className="problem-eof-illustration__svg"
        viewBox="0 0 360 200"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
      >
        <title>输入流末尾 EOF（/0）</title>
        <rect
          x="8"
          y="8"
          width="344"
          height="184"
          rx="12"
          className="problem-eof-illustration__frame"
        />
        <rect
          x="8"
          y="8"
          width="344"
          height="36"
          rx="12"
          className="problem-eof-illustration__titlebar"
        />
        <rect x="8" y="32" width="344" height="12" className="problem-eof-illustration__titlebar-fade" />
        <circle cx="28" cy="26" r="5" className="problem-eof-illustration__dot problem-eof-illustration__dot--a" />
        <circle cx="44" cy="26" r="5" className="problem-eof-illustration__dot problem-eof-illustration__dot--b" />
        <circle cx="60" cy="26" r="5" className="problem-eof-illustration__dot problem-eof-illustration__dot--c" />
        <text
          x="180"
          y="28"
          textAnchor="middle"
          className="problem-eof-illustration__title-text"
        >
          stdin
        </text>

        <rect x="32" y="58" width="200" height="10" rx="5" className="problem-eof-illustration__skeleton" />
        <rect x="32" y="78" width="260" height="10" rx="5" className="problem-eof-illustration__skeleton" />
        <rect x="32" y="98" width="180" height="10" rx="5" className="problem-eof-illustration__skeleton" />
        <rect x="32" y="118" width="220" height="10" rx="5" className="problem-eof-illustration__skeleton" />

        <rect x="32" y="148" width="120" height="10" rx="5" className="problem-eof-illustration__skeleton problem-eof-illustration__skeleton--dim" />
        <rect
          x="168"
          y="140"
          width="52"
          height="26"
          rx="6"
          className="problem-eof-illustration__eof-bg"
        />
        <text
          x="194"
          y="158"
          textAnchor="middle"
          className="problem-eof-illustration__eof-label"
        >
          /0
        </text>
        <text
          x="254"
          y="182"
          textAnchor="middle"
          className="problem-eof-illustration__hint"
        >
          ↑ 读到这里，系统返回 EOF
        </text>
      </svg>
    </figure>
  );
}
