import { Icon } from "../../../icons/index.jsx";

export default function AgentSidebar({
  mode = "desktop",
  sidebarCollapsed,
  setSidebarOpen,
  toggleDesktopSidebar,
  startNewChat,
  sortedConversations,
  activeId,
  editingId,
  editingTitle,
  setEditingTitle,
  renameWrapRef,
  renameInputRef,
  commitRename,
  cancelRename,
  loadConversation,
  generatingIds,
  togglePin,
  startRename,
  deleteConversation,
}) {
  const isDrawer = mode === "drawer";
  const collapsed = !isDrawer && sidebarCollapsed;
  const onToggle = () => {
    if (isDrawer) setSidebarOpen(false);
    else toggleDesktopSidebar();
  };

  return (
    <>
      <div className="agent-sidebar__top">
        <button
          type="button"
          className="agent-sidebar__collapse"
          onClick={onToggle}
          title={collapsed ? "展开侧栏" : "收起侧栏"}
          aria-label={collapsed ? "展开侧栏" : "收起侧栏"}
        >
          <Icon name={collapsed ? "sidebar-expand" : "sidebar"} size={18} color="currentColor" />
        </button>
      </div>
      <div className="agent-sidebar__body">
        <div className="agent-sidebar__header">
          <button type="button" className="agent-sidebar__new" onClick={startNewChat}>
            <Icon name="write" size={16} color="currentColor" />
            创建新聊天
          </button>
        </div>
        <div className="agent-sidebar__section-label">最近</div>
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
              {editingId === c.id ? (
                <span
                  ref={renameWrapRef}
                  className="agent-sidebar__rename-wrap"
                  onClick={(e) => e.stopPropagation()}
                >
                  <input
                    ref={renameInputRef}
                    className="agent-sidebar__rename-input"
                    value={editingTitle}
                    onChange={(e) => setEditingTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        commitRename(c.id);
                      }
                      if (e.key === "Escape") {
                        e.preventDefault();
                        cancelRename();
                      }
                    }}
                  />
                </span>
              ) : (
                <span className="agent-sidebar__item-title">
                  <span className="agent-sidebar__item-title-text">{c.title}</span>
                  {generatingIds.has(c.id) && activeId !== c.id && (
                    <Icon
                      name="loader"
                      size={13}
                      color="currentColor"
                      className="agent-sidebar__gen-spin"
                    />
                  )}
                </span>
              )}
              <div className="agent-sidebar__trailing">
                {c.pinned && editingId !== c.id && (
                  <span className="agent-sidebar__pin-mark" title="已置顶" aria-label="已置顶">
                    <Icon name="pin" size={12} color="var(--accent)" />
                  </span>
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
              </div>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
