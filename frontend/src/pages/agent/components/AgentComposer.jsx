import { Icon } from "../../../icons/index.jsx";
import { resumeKindIcon } from "../utils.js";

export default function AgentComposer({
  resumeMode,
  setResumeMode,
  resumeText,
  setResumeText,
  resumeAttachment,
  resumeChipRef,
  resumeChipWidth,
  fileInputRef,
  resumeAccept,
  handleResumeFile,
  clearResumeAttachment,
  handleResumeInterview,
  question,
  setQuestion,
  handleSubmit,
  loading,
  stopGeneration,
  isBuiltin,
  apiKey,
}) {
  return (
    <div className="agent-input">
      <div className="agent-input__mode-bar">
        <button
          type="button"
          className={`agent-input__mode ${!resumeMode ? "agent-input__mode--active" : ""}`}
          onClick={() => setResumeMode(false)}
        >
          <Icon name="message" size={14} color={!resumeMode ? "var(--accent)" : "var(--text-muted)"} />
          智能问答
        </button>
        <button
          type="button"
          className={`agent-input__mode ${resumeMode ? "agent-input__mode--active" : ""}`}
          onClick={() => setResumeMode(true)}
        >
          <Icon name="file-text" size={14} color={resumeMode ? "var(--accent)" : "var(--text-muted)"} />
          简历模拟面试
        </button>
        {resumeMode && (
          <input
            ref={fileInputRef}
            type="file"
            accept={resumeAccept}
            className="agent-input__file"
            onChange={handleResumeFile}
          />
        )}
        {resumeMode && !resumeAttachment && (
          <button
            type="button"
            className="agent-input__mode agent-input__upload-btn"
            onClick={() => fileInputRef.current?.click()}
            disabled={loading}
            title="上传 PDF / Markdown / Word 简历"
          >
            <Icon name="plus" size={14} color="var(--text-muted)" />
            上传简历
          </button>
        )}
      </div>

      {resumeMode ? (
        <form className="agent-input__wrap" onSubmit={handleResumeInterview}>
          <div className={`agent-input__composer${resumeAttachment ? " agent-input__composer--with-chip" : ""}`}>
            {resumeAttachment && (
              <div
                ref={resumeChipRef}
                className={`agent-resume-chip agent-resume-chip--${resumeAttachment.status}`}
              >
                <span className="agent-resume-chip__main">
                  {resumeAttachment.status === "uploading" ? (
                    <>
                      <Icon name="loader" size={14} color="currentColor" className="agent-resume-chip__spin" />
                      <span className="agent-resume-chip__text">上传简历中…</span>
                    </>
                  ) : (
                    <>
                      <Icon
                        name={resumeKindIcon(resumeAttachment.kind)}
                        size={14}
                        color="currentColor"
                      />
                      <span className="agent-resume-chip__name" title={resumeAttachment.fileName}>
                        {resumeAttachment.fileName}
                      </span>
                    </>
                  )}
                </span>
                <button
                  type="button"
                  className="agent-resume-chip__close"
                  title={resumeAttachment.status === "uploading" ? "取消上传" : "移除简历"}
                  aria-label={resumeAttachment.status === "uploading" ? "取消上传" : "移除简历"}
                  onClick={(ev) => {
                    ev.preventDefault();
                    ev.stopPropagation();
                    clearResumeAttachment();
                  }}
                >
                  <Icon name="x" size={12} color="currentColor" />
                </button>
              </div>
            )}
            <textarea
              className="agent-input__textarea"
              rows={3}
              placeholder={
                resumeAttachment
                  ? "可补充说明（可选），然后按回车生成面试题"
                  : "粘贴简历，或点上方「上传简历」；支持 PDF / MD / DOCX；回车发送"
              }
              value={resumeText}
              onChange={(e) => setResumeText(e.target.value)}
              required={!resumeAttachment}
              disabled={loading || resumeAttachment?.status === "uploading"}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  const canSend =
                    !loading &&
                    resumeAttachment?.status !== "uploading" &&
                    (!!resumeText.trim() || resumeAttachment?.status === "ready") &&
                    (isBuiltin || apiKey.trim());
                  if (canSend) e.currentTarget.form?.requestSubmit();
                }
              }}
              style={
                resumeAttachment && resumeChipWidth
                  ? { textIndent: `${resumeChipWidth + 10}px` }
                  : undefined
              }
            />
          </div>
          {loading ? (
            <button type="button" className="agent-input__submit agent-input__submit--stop" onClick={stopGeneration} title="停止生成">
              <Icon name="stop" size={18} color="var(--on-accent)" />
            </button>
          ) : (
            <button
              type="submit"
              className="agent-input__submit"
              disabled={
                resumeAttachment?.status === "uploading" ||
                (!resumeText.trim() && resumeAttachment?.status !== "ready")
              }
              title="生成面试题"
            >
              <Icon name="lightbulb" size={20} color="var(--on-accent)" />
            </button>
          )}
        </form>
      ) : (
        <form className="agent-input__wrap" onSubmit={handleSubmit}>
          <textarea
            className="agent-input__textarea"
            rows={3}
            placeholder="例如：华为机考通过线是多少？"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            disabled={loading}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                if (!loading && question.trim() && (isBuiltin || apiKey.trim())) {
                  e.currentTarget.form?.requestSubmit();
                }
              }
            }}
            required
          />
          {loading ? (
            <button type="button" className="agent-input__submit agent-input__submit--stop" onClick={stopGeneration} title="停止生成">
              <Icon name="stop" size={18} color="var(--on-accent)" />
            </button>
          ) : (
            <button
              type="submit"
              className="agent-input__submit"
              disabled={!question.trim()}
              title="发送"
            >
              <Icon name="arrow" size={20} color="var(--on-accent)" />
            </button>
          )}
        </form>
      )}
    </div>
  );
}
