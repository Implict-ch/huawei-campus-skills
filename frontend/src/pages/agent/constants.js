export const HISTORY_KEY = "hw-agent-history";
export const ACTIVE_KEY = "hw-agent-active-id";
export const NEAR_BOTTOM_PX = 120;
/** 长对话消息懒加载：初始只渲染最近 N 条，上滑再加载更早消息 */
export const MESSAGE_PAGE_SIZE = 24;
/** 暂时隐藏模型选择 / 自定义 API，统一走内置模型；改回 true 即可恢复 */
export const SHOW_MODEL_SETTINGS = false;
export const FORCED_MODEL = "builtin-deepseek";
export const RESUME_MAX_BYTES = 5 * 1024 * 1024;
export const RESUME_ACCEPT =
  ".pdf,.md,.markdown,.docx,application/pdf,text/markdown,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document";
