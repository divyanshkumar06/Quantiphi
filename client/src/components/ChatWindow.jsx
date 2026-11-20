import React, { useEffect, useRef } from "react";
import MessageBubble from "./MessageBubble.jsx";

export default function ChatWindow({
  messages,
  streamingMessage,
  isStreaming,
  onRegenerate
}) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingMessage]);

  return (
    <div className="chat-window">
      {messages.length === 0 && !isStreaming ? (
        <div className="empty-state">
          <div className="empty-icon">💬</div>
          <h2>Welcome to AI Chat Assistant</h2>
          <p>
            Choose your preferred tone below and send a prompt to start real-time streaming.
          </p>
        </div>
      ) : (
        <div className="messages-list">
          {messages.map((msg, index) => (
            <MessageBubble
              key={index}
              message={msg}
              isLast={index === messages.length - 1}
              isStreaming={isStreaming}
              onRegenerate={onRegenerate}
            />
          ))}

          {isStreaming && (
            <div className="message-row ai">
              <div className="message-wrapper">
                <div className="message-sender">AI Assistant (Streaming)</div>
                <div className="message-bubble streaming">
                  {streamingMessage ? (
                    <p className="message-text">{streamingMessage}</p>
                  ) : (
                    <div className="typing-indicator">
                      <span></span>
                      <span></span>
                      <span></span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      )}
    </div>
  );
}
