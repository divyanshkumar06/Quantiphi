import React, { useState, useRef, useEffect } from "react";
import ToneSelector from "./ToneSelector.jsx";

export default function ChatInput({ onSendMessage, isStreaming, tone, onToneChange }) {
  const [input, setInput] = useState("");
  const textareaRef = useRef(null);

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (!input.trim() || isStreaming) return;
    onSendMessage(input.trim());
    setInput("");
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  useEffect(() => {
    if (!isStreaming) {
      textareaRef.current?.focus();
    }
  }, [isStreaming]);

  return (
    <div className="chat-input-wrapper">
      <div className="input-toolbar">
        <ToneSelector tone={tone} onToneChange={onToneChange} disabled={isStreaming} />
      </div>
      <form className="chat-input-form" onSubmit={handleSubmit}>
        <textarea
          ref={textareaRef}
          className="chat-textarea"
          placeholder="Ask a question or type a message... (Press Enter to send)"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={2}
          disabled={isStreaming}
        />
        <button
          type="submit"
          className="send-btn"
          disabled={!input.trim() || isStreaming}
        >
          {isStreaming ? "Streaming..." : "Send"}
        </button>
      </form>
    </div>
  );
}
