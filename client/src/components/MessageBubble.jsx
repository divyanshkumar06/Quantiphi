import React, { useState } from "react";

export default function MessageBubble({ message, isLast, isStreaming, onRegenerate }) {
  const [copied, setCopied] = useState(false);
  const isAI = message.role === "assistant";

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy text:", err);
    }
  };

  return (
    <div className={`message-row ${isAI ? "ai" : "user"}`}>
      <div className="message-wrapper">
        <div className="message-sender">{isAI ? "AI Assistant" : "You"}</div>
        <div className="message-bubble">
          <p className="message-text">{message.content}</p>
        </div>

        {isAI && (
          <div className="message-actions">
            <button
              type="button"
              className="action-btn"
              onClick={handleCopy}
              title="Copy message"
            >
              {copied ? "✓ Copied" : "📋 Copy"}
            </button>

            {isLast && !isStreaming && onRegenerate && (
              <button
                type="button"
                className="action-btn"
                onClick={onRegenerate}
                title="Regenerate last response"
              >
                🔄 Regenerate
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
