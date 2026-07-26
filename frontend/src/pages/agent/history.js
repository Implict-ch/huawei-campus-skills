import { HISTORY_KEY, ACTIVE_KEY } from "./constants.js";

export function emptyComposer() {
  return {
    resumeMode: false,
    question: "",
    resumeText: "",
    resumeAttachment: null,
    resumeSessionId: "",
    resumeSelectedIndex: 0,
  };
}

/** 从会话记录恢复底部输入区状态（模式 / 文本 / 附件芯片） */
export function readComposerFromConv(conv) {
  const c = conv?.composer;
  const base = emptyComposer();
  if (!c || typeof c !== "object") return base;
  const attachment =
    c.resumeAttachment?.status === "ready" && c.resumeAttachment.token
      ? {
          status: "ready",
          fileName: c.resumeAttachment.fileName || "resume",
          kind: c.resumeAttachment.kind,
          token: c.resumeAttachment.token,
        }
      : null;
  return {
    resumeMode: !!c.resumeMode,
    question: typeof c.question === "string" ? c.question : "",
    resumeText: typeof c.resumeText === "string" ? c.resumeText : "",
    resumeAttachment: attachment,
    resumeSessionId: typeof c.resumeSessionId === "string" ? c.resumeSessionId : "",
    resumeSelectedIndex: Number.isFinite(c.resumeSelectedIndex) ? c.resumeSelectedIndex : 0,
  };
}

export function migrateConversation(c) {
  const base = c && Array.isArray(c.messages)
    ? { ...c }
    : (() => {
        const messages = [];
        if (c && c.question) messages.push({ role: "user", content: c.question });
        if (c && c.answer) messages.push({ role: "assistant", content: c.answer });
        return { ...c, messages };
      })();
  return {
    ...base,
    pinned: !!base.pinned,
    titleLocked: !!base.titleLocked,
    timestamp: base.timestamp || Date.now(),
  };
}

export function sortConversations(list) {
  return [...list].sort((a, b) => {
    if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
    return (b.timestamp || 0) - (a.timestamp || 0);
  });
}

export function loadHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    return JSON.parse(raw).map(migrateConversation);
  } catch {
    return [];
  }
}

export function loadActiveId(conversations) {
  try {
    const id = localStorage.getItem(ACTIVE_KEY);
    if (!id) return null;
    if (conversations.some((c) => c.id === id)) return id;
    return conversations[0]?.id || null;
  } catch {
    return conversations[0]?.id || null;
  }
}
