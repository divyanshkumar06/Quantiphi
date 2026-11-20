import React, { useState, useEffect } from "react";
import Sidebar from "./components/Sidebar.jsx";
import ChatWindow from "./components/ChatWindow.jsx";
import ChatInput from "./components/ChatInput.jsx";

const API_BASE = "http://localhost:5000/api";

export default function App() {
  const [conversations, setConversations] = useState([]);
  const [currentConversationId, setCurrentConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [tone, setTone] = useState("Professional");
  const [streamingMessage, setStreamingMessage] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState(null);

  // Fetch conversation history list on component mount
  useEffect(() => {
    fetchConversations();
  }, []);

  const fetchConversations = async () => {
    try {
      const res = await fetch(`${API_BASE}/conversations`);
      if (res.ok) {
        const data = await res.json();
        setConversations(data);
      }
    } catch (err) {
      console.error("Failed to load conversations:", err);
    }
  };

  const handleSelectConversation = async (id) => {
    if (isStreaming) return;
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/conversations/${id}`);
      if (!res.ok) throw new Error("Could not load conversation");
      const data = await res.json();
      setCurrentConversationId(data._id);
      setMessages(data.messages || []);
      setTone(data.tone || "Professional");
    } catch (err) {
      setError(err.message);
    }
  };

  const handleNewChat = () => {
    if (isStreaming) return;
    setCurrentConversationId(null);
    setMessages([]);
    setStreamingMessage("");
    setError(null);
    setTone("Professional");
  };

  const handleDeleteConversation = async (id) => {
    try {
      const res = await fetch(`${API_BASE}/conversations/${id}`, {
        method: "DELETE"
      });
      if (res.ok) {
        if (currentConversationId === id) {
          handleNewChat();
        }
        fetchConversations();
      }
    } catch (err) {
      setError("Failed to delete conversation");
    }
  };

  /**
   * Helper function to consume a Server-Sent Events (SSE) stream via fetch & ReadableStream
   */
  const readSSEStream = async (response, onChunk, onConversationId) => {
    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n\n");
      buffer = lines.pop(); // Keep the tail in buffer

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;

        const rawData = trimmed.replace(/^data:\s*/, "");
        if (rawData === "[DONE]") {
          return;
        }

        let parsed;
        try {
          parsed = JSON.parse(rawData);
        } catch (e) {
          if (rawData !== "[DONE]") {
            console.warn("SSE parse error or payload:", rawData);
          }
          continue;
        }

        if (parsed.error) {
          throw new Error(parsed.error);
        }
        if (parsed.conversationId && onConversationId) {
          onConversationId(parsed.conversationId);
        }
        if (parsed.chunk) {
          onChunk(parsed.chunk);
        }
      }
    }
  };

  // Send a message and stream the AI response
  const handleSendMessage = async (promptText) => {
    if (!promptText.trim() || isStreaming) return;

    setError(null);
    const userMessage = {
      role: "user",
      content: promptText,
      timestamp: new Date().toISOString()
    };

    // Optimistically show user message
    setMessages((prev) => [...prev, userMessage]);
    setIsStreaming(true);
    setStreamingMessage("");

    let accumulatedAIResponse = "";
    let targetConversationId = currentConversationId || "new";

    try {
      const response = await fetch(`${API_BASE}/chat/${targetConversationId}/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: promptText, tone })
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || `Server error: ${response.status}`);
      }

      await readSSEStream(
        response,
        (chunk) => {
          accumulatedAIResponse += chunk;
          setStreamingMessage((prev) => prev + chunk);
        },
        (newId) => {
          if (!currentConversationId) {
            setCurrentConversationId(newId);
          }
        }
      );

      // Commit full response to messages list
      if (accumulatedAIResponse) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: accumulatedAIResponse,
            timestamp: new Date().toISOString()
          }
        ]);
      }

      fetchConversations();
    } catch (err) {
      console.error("Stream failed:", err);
      setError(err.message || "Failed to get AI response.");
    } finally {
      setIsStreaming(false);
      setStreamingMessage("");
    }
  };

  // Regenerate the last AI response
  const handleRegenerate = async () => {
    if (!currentConversationId || isStreaming || messages.length === 0) return;

    setError(null);
    // Remove last message from state if it was assistant
    const lastMessage = messages[messages.length - 1];
    if (lastMessage.role === "assistant") {
      setMessages((prev) => prev.slice(0, -1));
    }

    setIsStreaming(true);
    setStreamingMessage("");
    let accumulatedResponse = "";

    try {
      const response = await fetch(`${API_BASE}/chat/${currentConversationId}/regenerate`, {
        method: "POST"
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || "Failed to regenerate response");
      }

      await readSSEStream(response, (chunk) => {
        accumulatedResponse += chunk;
        setStreamingMessage((prev) => prev + chunk);
      });

      if (accumulatedResponse) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: accumulatedResponse,
            timestamp: new Date().toISOString()
          }
        ]);
      }
    } catch (err) {
      console.error("Regeneration failed:", err);
      setError(err.message || "Failed to regenerate response");
    } finally {
      setIsStreaming(false);
      setStreamingMessage("");
    }
  };

  return (
    <div className="app-layout">
      <Sidebar
        conversations={conversations}
        activeId={currentConversationId}
        onSelectConversation={handleSelectConversation}
        onNewChat={handleNewChat}
        onDeleteConversation={handleDeleteConversation}
      />

      <main className="chat-main">
        <header className="chat-header">
          <div className="header-info">
            <h1 className="header-title">AI Chat Assistant</h1>
            <span className="header-badge">{tone} Mode</span>
          </div>
        </header>

        {error && (
          <div className="error-banner">
            <span>⚠️ {error}</span>
            <button className="error-dismiss" onClick={() => setError(null)}>
              ✕
            </button>
          </div>
        )}

        <ChatWindow
          messages={messages}
          streamingMessage={streamingMessage}
          isStreaming={isStreaming}
          onRegenerate={handleRegenerate}
        />

        <ChatInput
          onSendMessage={handleSendMessage}
          isStreaming={isStreaming}
          tone={tone}
          onToneChange={setTone}
        />
      </main>
    </div>
  );
}
