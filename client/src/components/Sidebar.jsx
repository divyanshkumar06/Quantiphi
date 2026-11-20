import React from "react";

export default function Sidebar({
  conversations,
  activeId,
  onSelectConversation,
  onNewChat,
  onDeleteConversation
}) {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <button type="button" className="new-chat-btn" onClick={onNewChat}>
          + New Chat
        </button>
      </div>

      <div className="sidebar-history">
        <div className="history-title">Previous Chats</div>
        {conversations.length === 0 ? (
          <div className="history-empty">No conversations yet</div>
        ) : (
          <ul className="history-list">
            {conversations.map((item) => (
              <li
                key={item._id}
                className={`history-item ${activeId === item._id ? "active" : ""}`}
                onClick={() => onSelectConversation(item._id)}
              >
                <div className="item-details">
                  <span className="item-title">{item.title || "Untitled Chat"}</span>
                  <span className="item-meta">{item.tone || "Professional"}</span>
                </div>
                <button
                  type="button"
                  className="delete-btn"
                  title="Delete chat"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteConversation(item._id);
                  }}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}
