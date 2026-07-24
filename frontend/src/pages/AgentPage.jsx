import { useState, useEffect, useRef, useMemo } from "react";
import { Link } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { Icon } from "../icons/index.jsx";
import { AGENT_PAGE_CONTENT } from "../data/hw-app.js";

const HISTORY_KEY = "hw-agent-history";
const ACTIVE_KEY = "hw-agent-active-id";

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

async function readSSEStream(res, onChunk, onMeta) {
  if (!res.body) throw new Error("浏览器不支持流式响应");
  const reader = res.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let answer = "";
  let done = false;
  while (!done) {
    const { value, done: readerDone } = await reader.read();
    done = readerDone;
    if (!value) continue;
    const text = decoder.decode(value, { stream: true });
    const lines = text.split("\n").filter(Boolean);
    for (const line of lines) {
      const dataLine = line.startsWith("data: ") ? line.slice(6) : line;
      if (dataLine === "[DONE]") {
        done = true;
        continue;
      }
      let parsed;
      try {
        parsed = JSON.parse(dataLine);
      } catch {
        continue;
      }
      if (parsed.error) throw new Error(parsed.error);
      if (parsed.meta && onMeta) onMeta(parsed.meta);
      if (typeof parsed.chunk === "string") {
        answer += parsed.chunk;
        if (onChunk) onChunk(answer);
      }
    }
  }
  return answer;
}

function formatTitle(question) {
  let t = String(question || "")
    .replace(/^【简历模拟面试】\s*/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!t) return "新对话";
  return t.length > 28 ? t.slice(0, 28) + "…" : t;
}

/** 从简历正文提取更可读的历史标题 */
function formatResumeTitle(resumeText, fileName) {
  if (fileName) {
    const base = fileName.replace(/\.(pdf|txt|md)$/i, "");
    return formatTitle(`简历面试 · ${base}`);
  }
  const text = String(resumeText || "")
    .replace(/^【简历模拟面试】\s*/m, "")
    .trim();
  const nameMatch = text.match(/(?:姓名|名字)\s*[:：]?\s*([^\n，,|】*]{2,12})/);
  const roleMatch = text.match(/(?:求职意向|目标岗位|应聘岗位|意向岗位|岗位意向)\s*[:：]?\s*([^\n]{2,24})/);
  const name = nameMatch?.[1]?.replace(/[*#`]/g, "").trim();
  const role = roleMatch?.[1]?.replace(/[*#`]/g, "").trim();
  if (name && role) return formatTitle(`${name} · ${role}`);
  if (role) return formatTitle(`简历面试 · ${role}`);
  if (name) return formatTitle(`简历面试 · ${name}`);
  const line = text
    .split(/\n/)
    .map((l) => l.trim().replace(/^#+\s*/, "").replace(/[*`]/g, ""))
    .find((l) => l && !l.startsWith("-") && !l.startsWith("【") && l.length >= 2 && l.length <= 40);
  if (line) return formatTitle(`简历面试 · ${line}`);
  return "简历模拟面试";
}

function migrateConversation(c) {
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

function sortConversations(list) {
  return [...list].sort((a, b) => {
    if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
    return (b.timestamp || 0) - (a.timestamp || 0);
  });
}

function loadHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    return JSON.parse(raw).map(migrateConversation);
  } catch {
    return [];
  }
}

function loadActiveId(conversations) {
  try {
    const id = localStorage.getItem(ACTIVE_KEY);
    if (!id) return null;
    if (conversations.some((c) => c.id === id)) return id;
    return conversations[0]?.id || null;
  } catch {
    return conversations[0]?.id || null;
  }
}

function isInternalPath(href) {
  if (!href) return false;
  if (href.startsWith("/") && !href.startsWith("//")) return true;
  try {
    const url = new URL(href, window.location.origin);
    return url.origin === window.location.origin;
  } catch {
    return false;
  }
}

function toInternalPath(href) {
  if (href.startsWith("/") && !href.startsWith("//")) return href;
  try {
    const url = new URL(href, window.location.origin);
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return href;
  }
}

/** 站内链接带上 from=agent，详情页可据此显示「返回智能问答」 */
function withAgentReferrer(href) {
  try {
    const url = new URL(toInternalPath(href), window.location.origin);
    url.searchParams.set("from", "agent");
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    const base = toInternalPath(href);
    return base.includes("?") ? `${base}&from=agent` : `${base}?from=agent`;
  }
}

const markdownComponents = {
  a: ({ href, children }) => {
    if (isInternalPath(href)) {
      return (
        <Link to={withAgentReferrer(href)} state={{ from: "agent" }}>
          {children}
        </Link>
      );
    }
    return (
      <a href={href} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    );
  },
};

export default function AgentPage() {
  const initialConversations = useMemo(() => loadHistory(), []);
  const [conversations, setConversations] = useState(initialConversations);
  const [activeId, setActiveId] = useState(() => loadActiveId(initialConversations));
  const [messages, setMessages] = useState(() => {
    const id = loadActiveId(initialConversations);
    const conv = initialConversations.find((c) => c.id === id);
    return conv?.messages || [];
  });
  const [question, setQuestion] = useState("");
  const [model, setModel] = useState("builtin-deepseek");
  const [customBaseUrl, setCustomBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const isBuiltin = model === "builtin-deepseek";
  const [showKey, setShowKey] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resumeMode, setResumeMode] = useState(false);
  const [resumeText, setResumeText] = useState("");
  const [resumeSessionId, setResumeSessionId] = useState("");
  const [resumeSelectedIndex, setResumeSelectedIndex] = useState(0);
  const [resumeHasPdf, setResumeHasPdf] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editingTitle, setEditingTitle] = useState("");

  const selectedModel = AGENT_PAGE_CONTENT.models.find((m) => m.value === model) || AGENT_PAGE_CONTENT.models[0];
  const chatEndRef = useRef(null);
  const skipScrollRef = useRef(true);
  const fileInputRef = useRef(null);
  const resumePdfRef = useRef(null);
  const renameInputRef = useRef(null);

  const sortedConversations = useMemo(() => sortConversations(conversations), [conversations]);

  useEffect(() => {
    document.body.classList.add("agent-page-open");
    return () => document.body.classList.remove("agent-page-open");
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(conversations));
    } catch {
      // ignore quota errors
    }
  }, [conversations]);

  useEffect(() => {
    try {
      if (activeId) localStorage.setItem(ACTIVE_KEY, activeId);
      else localStorage.removeItem(ACTIVE_KEY);
    } catch {
      // ignore
    }
  }, [activeId]);

  useEffect(() => {
    const conv = conversations.find((c) => c.id === activeId);
    if (conv && Array.isArray(conv.messages)) {
      setMessages(conv.messages);
      if (conv.model) setModel(conv.model);
    } else if (!activeId) {
      setMessages([]);
    }
  }, [activeId, conversations]);

  useEffect(() => {
    if (skipScrollRef.current) {
      skipScrollRef.current = false;
      return;
    }
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, error]);

  function startNewChat() {
    setActiveId(null);
    setMessages([]);
    setQuestion("");
    setResumeText("");
    setResumeMode(false);
    setResumeSessionId("");
    setResumeSelectedIndex(0);
    setError("");
  }

  async function handleResumeFile(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const name = file.name.toLowerCase();
    try {
      if (name.endsWith(".pdf")) {
        const buf = await file.arrayBuffer();
        const bytes = new Uint8Array(buf);
        let binary = "";
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
        const pdfBase64 = btoa(binary);
        setResumeText(`【已选择 PDF：${file.name}，提交后将自动解析】`);
        resumePdfRef.current = { pdfBase64, fileName: file.name };
        setResumeHasPdf(true);
      } else {
        const text = await file.text();
        setResumeText(text);
        resumePdfRef.current = null;
        setResumeHasPdf(false);
      }
    } catch (err) {
      setError(err.message || "读取文件失败");
    }
  }

  function loadConversation(id) {
    const conv = conversations.find((c) => c.id === id);
    if (conv) setModel(conv.model);
    setActiveId(id);
    setError("");
  }

  function deleteConversation(id, e) {
    e.stopPropagation();
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (activeId === id) {
      setActiveId(null);
      setMessages([]);
    }
    if (editingId === id) {
      setEditingId(null);
      setEditingTitle("");
    }
  }

  function togglePin(id, e) {
    e.stopPropagation();
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, pinned: !c.pinned, timestamp: c.timestamp || Date.now() } : c))
    );
  }

  function startRename(id, e) {
    e.stopPropagation();
    const conv = conversations.find((c) => c.id === id);
    if (!conv) return;
    setEditingId(id);
    setEditingTitle(conv.title || "");
    setTimeout(() => renameInputRef.current?.focus(), 0);
  }

  function commitRename(id) {
    const next = editingTitle.trim();
    setConversations((prev) =>
      prev.map((c) =>
        c.id === id
          ? {
              ...c,
              title: next || c.title || "新对话",
              titleLocked: true,
            }
          : c
      )
    );
    setEditingId(null);
    setEditingTitle("");
  }

  function cancelRename() {
    setEditingId(null);
    setEditingTitle("");
  }

  function getModelBody() {
    const body = { model };
    if (!isBuiltin) body.apiKey = apiKey.trim();
    if (model === "custom" && customBaseUrl.trim()) {
      body.baseUrl = customBaseUrl.trim();
    } else if (selectedModel.baseUrl) {
      body.baseUrl = selectedModel.baseUrl;
    }
    return body;
  }

  async function handleResumeInterview(e) {
    e.preventDefault();
    const pdfPayload = resumePdfRef.current;
    const isPdfPlaceholder = resumeText.startsWith("【已选择 PDF：");
    if ((!resumeText.trim() && !pdfPayload) || loading) return;
    if (!isBuiltin && !apiKey.trim()) return;

    const rawResume = pdfPayload ? "" : resumeText.trim();
    const content = pdfPayload
      ? `【简历模拟面试】\n\n[PDF 简历] ${pdfPayload.fileName}`
      : `【简历模拟面试】\n\n${rawResume}`;
    const timestamp = Date.now();
    const userMessage = { role: "user", content };
    const autoTitle = formatResumeTitle(rawResume, pdfPayload?.fileName);

    let targetId = activeId;
    let nextMessages;

    const activeConv = conversations.find((c) => c.id === activeId);
    if (!activeConv) {
      targetId = generateId();
      nextMessages = [userMessage];
      setConversations((prev) => [
        {
          id: targetId,
          title: autoTitle,
          messages: nextMessages,
          model,
          timestamp,
          pinned: false,
          titleLocked: false,
        },
        ...prev,
      ]);
      setActiveId(targetId);
    } else {
      targetId = activeId;
      nextMessages = [...activeConv.messages, userMessage];
      setConversations((prev) =>
        prev.map((c) =>
          c.id === targetId
            ? {
                ...c,
                messages: nextMessages,
                timestamp,
                title: c.titleLocked ? c.title : autoTitle,
              }
            : c
        )
      );
    }

    setMessages(nextMessages);
    setLoading(true);
    setError("");
    setResumeSessionId("");
    const requestBody = {
      ...getModelBody(),
    };
    if (pdfPayload?.pdfBase64) {
      requestBody.pdfBase64 = pdfPayload.pdfBase64;
    } else {
      requestBody.resumeText = isPdfPlaceholder ? "" : resumeText.trim();
    }
    setResumeText("");
    resumePdfRef.current = null;
    setResumeHasPdf(false);

    try {
      const res = await fetch("/api/resume-interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "请求失败");
      }

      let streamingMessages = [...nextMessages, { role: "assistant", content: "" }];
      setMessages(streamingMessages);

      const answer = await readSSEStream(
        res,
        (partial) => {
          streamingMessages = streamingMessages.map((m, i) =>
            i === streamingMessages.length - 1 && m.role === "assistant" ? { ...m, content: partial } : m
          );
          setMessages([...streamingMessages]);
        },
        (meta) => {
          if (meta.sessionId) setResumeSessionId(meta.sessionId);
          if (typeof meta.selectedIndex === "number") setResumeSelectedIndex(meta.selectedIndex);
        }
      );

      const finalMessages = streamingMessages.map((m, i) =>
        i === streamingMessages.length - 1 && m.role === "assistant" ? { ...m, content: answer } : m
      );
      setConversations((prev) => prev.map((c) => (c.id === targetId ? { ...c, messages: finalMessages } : c)));
      setMessages(finalMessages);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleReshuffle() {
    if (!resumeSessionId || loading) return;
    if (!isBuiltin && !apiKey.trim()) return;

    const activeConv = conversations.find((c) => c.id === activeId);
    if (!activeConv) return;

    const userMessage = { role: "user", content: "换一组面试题" };
    const nextMessages = [...activeConv.messages, userMessage];
    const targetId = activeId;
    setConversations((prev) => prev.map((c) => (c.id === targetId ? { ...c, messages: nextMessages } : c)));
    setMessages(nextMessages);
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/resume-interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reshuffle",
          sessionId: resumeSessionId,
          excludeIndex: resumeSelectedIndex,
          ...getModelBody(),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "换一组失败");
      }

      let streamingMessages = [...nextMessages, { role: "assistant", content: "" }];
      setMessages(streamingMessages);

      const answer = await readSSEStream(
        res,
        (partial) => {
          streamingMessages = streamingMessages.map((m, i) =>
            i === streamingMessages.length - 1 && m.role === "assistant" ? { ...m, content: partial } : m
          );
          setMessages([...streamingMessages]);
        },
        (meta) => {
          if (meta.sessionId) setResumeSessionId(meta.sessionId);
          if (typeof meta.selectedIndex === "number") setResumeSelectedIndex(meta.selectedIndex);
        }
      );

      const finalMessages = streamingMessages.map((m, i) =>
        i === streamingMessages.length - 1 && m.role === "assistant" ? { ...m, content: answer } : m
      );
      setConversations((prev) => prev.map((c) => (c.id === targetId ? { ...c, messages: finalMessages } : c)));
      setMessages(finalMessages);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!question.trim() || loading) return;
    if (!isBuiltin && !apiKey.trim()) return;

    const trimmedQuestion = question.trim();
    const timestamp = Date.now();
    const userMessage = { role: "user", content: trimmedQuestion };

    let targetId = activeId;
    let nextMessages;
    let historyMessages;

    const activeConv = conversations.find((c) => c.id === activeId);
    if (!activeConv) {
      targetId = generateId();
      nextMessages = [userMessage];
      historyMessages = [];
      setConversations((prev) => [
        {
          id: targetId,
          title: formatTitle(trimmedQuestion),
          messages: nextMessages,
          model,
          timestamp,
          pinned: false,
          titleLocked: false,
        },
        ...prev,
      ]);
      setActiveId(targetId);
    } else {
      targetId = activeId;
      historyMessages = activeConv.messages;
      nextMessages = [...activeConv.messages, userMessage];
      setConversations((prev) =>
        prev.map((c) =>
          c.id === targetId
            ? {
                ...c,
                messages: nextMessages,
                timestamp,
                title: c.titleLocked || (c.messages && c.messages.length > 0) ? c.title : formatTitle(trimmedQuestion),
              }
            : c
        )
      );
    }

    setMessages(nextMessages);
    setLoading(true);
    setError("");
    setQuestion("");

    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: trimmedQuestion,
          history: historyMessages,
          ...getModelBody(),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "请求失败");
      }
      if (!res.body) throw new Error("浏览器不支持流式响应");

      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let answer = "";

      let streamingMessages = [...nextMessages, { role: "assistant", content: "" }];
      setMessages(streamingMessages);

      let done = false;
      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (!value) continue;

        const text = decoder.decode(value, { stream: true });
        const lines = text.split("\n").filter(Boolean);
        for (const line of lines) {
          const dataLine = line.startsWith("data: ") ? line.slice(6) : line;
          if (dataLine === "[DONE]") {
            done = true;
            continue;
          }
          let parsed;
          try {
            parsed = JSON.parse(dataLine);
          } catch {
            continue;
          }

          if (parsed.error) {
            throw new Error(parsed.error);
          }
          if (parsed.replace && parsed.answer) {
            answer = parsed.answer;
          } else if (typeof parsed.chunk === "string") {
            answer += parsed.chunk;
          }
          if (answer) {
            streamingMessages = streamingMessages.map((m, i) =>
              i === streamingMessages.length - 1 && m.role === "assistant" ? { ...m, content: answer } : m
            );
            setMessages([...streamingMessages]);
          }
        }
      }

      const finalMessages = streamingMessages.map((m, i) =>
        i === streamingMessages.length - 1 && m.role === "assistant" ? { ...m, content: answer } : m
      );
      setConversations((prev) => prev.map((c) => (c.id === targetId ? { ...c, messages: finalMessages } : c)));
      setMessages(finalMessages);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="hw-page hw-page--agent">
      <aside className="agent-sidebar">
        <div className="agent-sidebar__header">
          <button type="button" className="agent-sidebar__new" onClick={startNewChat}>
            <Icon name="plus" size={16} color="currentColor" />
            新对话
          </button>
        </div>
        <ul className="agent-sidebar__list">
          {sortedConversations.length === 0 && <li className="agent-sidebar__empty">暂无历史记录</li>}
          {sortedConversations.map((c) => (
            <li
              key={c.id}
              className={`agent-sidebar__item ${activeId === c.id ? "agent-sidebar__item--active" : ""} ${c.pinned ? "agent-sidebar__item--pinned" : ""}`}
              onClick={() => {
                if (editingId === c.id) return;
                loadConversation(c.id);
              }}
              title={c.title}
            >
              {c.pinned && (
                <span className="agent-sidebar__pin-mark" title="已置顶">
                  <Icon name="pin" size={12} color="var(--accent)" />
                </span>
              )}
              {editingId === c.id ? (
                <input
                  ref={renameInputRef}
                  className="agent-sidebar__rename-input"
                  value={editingTitle}
                  onChange={(e) => setEditingTitle(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitRename(c.id);
                    if (e.key === "Escape") cancelRename();
                  }}
                  onBlur={() => commitRename(c.id)}
                />
              ) : (
                <span className="agent-sidebar__item-title">{c.title}</span>
              )}
              <div className="agent-sidebar__actions">
                <button
                  type="button"
                  className={`agent-sidebar__action ${c.pinned ? "agent-sidebar__action--on" : ""}`}
                  onClick={(e) => togglePin(c.id, e)}
                  title={c.pinned ? "取消置顶" : "置顶"}
                >
                  <Icon name="pin" size={13} color="currentColor" />
                </button>
                <button
                  type="button"
                  className="agent-sidebar__action"
                  onClick={(e) => startRename(c.id, e)}
                  title="重命名"
                >
                  <Icon name="write" size={13} color="currentColor" />
                </button>
                <button
                  type="button"
                  className="agent-sidebar__delete"
                  onClick={(e) => deleteConversation(c.id, e)}
                  title="删除"
                >
                  ×
                </button>
              </div>
            </li>
          ))}
        </ul>
      </aside>

      <main className="agent-main">
        <header className="agent-main__header">
          <h2 className="agent-main__title">{AGENT_PAGE_CONTENT.hero.title}</h2>
          <div className="agent-main__settings">
            <label className="agent-main__label">
              模型
              <select className="agent-main__select" value={model} onChange={(e) => setModel(e.target.value)}>
                {AGENT_PAGE_CONTENT.models.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </label>

            {!isBuiltin && (
              <label className="agent-main__label">
                API Key
                <div className="agent-main__key-wrap">
                  <input
                    className="agent-main__input"
                    type={showKey ? "text" : "password"}
                    placeholder="sk-..."
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                  />
                  <button
                    type="button"
                    className="agent-main__toggle"
                    onClick={() => setShowKey((v) => !v)}
                  >
                    {showKey ? "隐藏" : "显示"}
                  </button>
                </div>
              </label>
            )}

            {model === "custom" && (
              <label className="agent-main__label">
                Base URL
                <input
                  className="agent-main__input"
                  type="url"
                  placeholder="https://api.example.com/v1"
                  value={customBaseUrl}
                  onChange={(e) => setCustomBaseUrl(e.target.value)}
                />
              </label>
            )}
          </div>
        </header>

        <div className="agent-chat">
          {messages.length === 0 && !error && (
            <div className="agent-chat__empty">
              <Icon name="robot" size={48} color="var(--accent)" />
              <p>有什么问题，我帮你查知识库。</p>
              <p className="agent-chat__hint">也可以点击下方「简历模拟面试」，粘贴简历生成面试题。</p>
            </div>
          )}

          {messages.map((m, i) => (
            <div
              key={i}
              className={`agent-message ${m.role === "user" ? "agent-message--user" : "agent-message--assistant"}`}
            >
              <div className="agent-message__avatar">
                {m.role === "user" ? "我" : <Icon name="robot" size={18} color="var(--on-accent)" />}
              </div>
              <div className="agent-message__body">
                {m.role === "assistant" ? (
                  <ReactMarkdown components={markdownComponents}>{m.content}</ReactMarkdown>
                ) : (
                  <p className="agent-message__user-text">{m.content}</p>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="agent-message agent-message--assistant">
              <div className="agent-message__avatar">
                <Icon name="robot" size={18} color="var(--on-accent)" />
              </div>
              <div className="agent-message__body agent-message__body--loading">
                <span className="agent-message__dot" />
                <span className="agent-message__dot" />
                <span className="agent-message__dot" />
              </div>
            </div>
          )}

          {error && (
            <div className="agent-message agent-message--error">
              <div className="agent-message__avatar">
                <Icon name="alert-triangle" size={18} color="var(--on-accent)" />
              </div>
              <div className="agent-message__body">{error}</div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

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
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt,.md,.pdf,text/plain,application/pdf"
                  className="agent-input__file"
                  onChange={handleResumeFile}
                />
                <button
                  type="button"
                  className="agent-input__mode"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={loading}
                  title="上传 PDF / TXT 简历"
                >
                  <Icon name="plus" size={14} color="var(--text-muted)" />
                  上传简历
                </button>
              </>
            )}
            {resumeSessionId && (
              <button
                type="button"
                className="agent-input__mode"
                onClick={handleReshuffle}
                disabled={loading}
                title="从已生成的备选方案中再抽一套"
              >
                <Icon name="layers" size={14} color="var(--text-muted)" />
                换一组
              </button>
            )}
          </div>

          {resumeMode ? (
            <form className="agent-input__wrap" onSubmit={handleResumeInterview}>
              <textarea
                className="agent-input__textarea"
                rows={3}
                placeholder="粘贴简历，或点上方「上传简历」；将生成多套备选并随机抽取一套"
                value={resumeText}
                onChange={(e) => {
                  resumePdfRef.current = null;
                  setResumeHasPdf(false);
                  setResumeText(e.target.value);
                }}
                required={!resumeHasPdf}
              />
              <button
                type="submit"
                className="agent-input__submit"
                disabled={loading || (!resumeText.trim() && !resumeHasPdf)}
                title="生成面试题"
              >
                <Icon name="lightbulb" size={20} color="var(--on-accent)" />
              </button>
            </form>
          ) : (
            <form className="agent-input__wrap" onSubmit={handleSubmit}>
              <textarea
                className="agent-input__textarea"
                rows={3}
                placeholder="例如：华为机考通过线是多少？"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                required
              />
              <button
                type="submit"
                className="agent-input__submit"
                disabled={loading || !question.trim()}
                title="发送"
              >
                <Icon name="arrow" size={20} color="var(--on-accent)" />
              </button>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
