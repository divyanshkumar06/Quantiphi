import express from "express";
import { Conversation } from "../models/Conversation.js";
import { createChatStream } from "../services/aiService.js";

const router = express.Router();

// GET all conversations for the history sidebar
router.get("/conversations", async (req, res) => {
  try {
    const list = await Conversation.find()
      .select("title tone createdAt updatedAt")
      .sort({ updatedAt: -1 });
    res.json(list);
  } catch (err) {
    console.error("Error fetching conversations:", err);
    res.status(500).json({ error: "Failed to fetch conversations" });
  }
});

// GET a specific conversation by ID
router.get("/conversations/:id", async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.params.id);
    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }
    res.json(conversation);
  } catch (err) {
    console.error("Error fetching conversation:", err);
    res.status(500).json({ error: "Failed to fetch conversation" });
  }
});

// DELETE a conversation by ID
router.delete("/conversations/:id", async (req, res) => {
  try {
    const deleted = await Conversation.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: "Conversation not found" });
    }
    res.json({ message: "Conversation deleted successfully", id: req.params.id });
  } catch (err) {
    console.error("Error deleting conversation:", err);
    res.status(500).json({ error: "Failed to delete conversation" });
  }
});

// POST send message and stream AI response via SSE
router.post("/chat/:id/message", async (req, res) => {
  const { message, tone = "Professional" } = req.body;
  const conversationId = req.params.id;

  if (!message || !message.trim()) {
    return res.status(400).json({ error: "Message is required" });
  }

  let conversation;

  try {
    // 1. Retrieve or create conversation
    if (conversationId && conversationId !== "new") {
      conversation = await Conversation.findById(conversationId);
    }

    if (!conversation) {
      // Auto-generate title from the first prompt (up to 35 characters)
      const title = message.trim().slice(0, 35) + (message.length > 35 ? "..." : "");
      conversation = new Conversation({
        title,
        tone,
        messages: []
      });
    } else {
      conversation.tone = tone;
    }

    // 2. Append user prompt
    conversation.messages.push({
      role: "user",
      content: message
    });
    await conversation.save();

    // 3. Set SSE response headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    if (res.flushHeaders) res.flushHeaders();

    // Send conversationId to client so frontend knows where to bind
    res.write(`data: ${JSON.stringify({ conversationId: conversation._id })}\n\n`);

    // 4. Handle client disconnection
    let isClientConnected = true;
    req.on("close", () => {
      isClientConnected = false;
    });

    // 5. Stream from OpenAI
    const stream = await createChatStream(conversation.messages, tone);
    let fullResponse = "";

    for await (const chunk of stream) {
      if (!isClientConnected) break;
      const content = chunk.choices[0]?.delta?.content || "";
      if (content) {
        fullResponse += content;
        res.write(`data: ${JSON.stringify({ chunk: content })}\n\n`);
      }
    }

    // 6. Persist completed AI response to MongoDB
    if (fullResponse) {
      conversation.messages.push({
        role: "assistant",
        content: fullResponse
      });
      await conversation.save();
    }

    // 7. Signal end of stream
    res.write("data: [DONE]\n\n");
    res.end();
  } catch (err) {
    console.error("Chat streaming error:", err);
    if (!res.headersSent) {
      return res.status(500).json({ error: err.message || "Failed to process chat" });
    }
    res.write(`data: ${JSON.stringify({ error: err.message || "Streaming failed" })}\n\n`);
    res.end();
  }
});

// POST regenerate the last AI response via SSE
router.post("/chat/:id/regenerate", async (req, res) => {
  const conversationId = req.params.id;

  try {
    const conversation = await Conversation.findById(conversationId);
    if (!conversation || conversation.messages.length === 0) {
      return res.status(404).json({ error: "Conversation not found or empty" });
    }

    // Remove the last assistant message if present
    const lastMsg = conversation.messages[conversation.messages.length - 1];
    if (lastMsg.role === "assistant") {
      conversation.messages.pop();
      await conversation.save();
    }

    // Set SSE response headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    if (res.flushHeaders) res.flushHeaders();

    let isClientConnected = true;
    req.on("close", () => {
      isClientConnected = false;
    });

    // Stream fresh response
    const stream = await createChatStream(conversation.messages, conversation.tone);
    let fullResponse = "";

    for await (const chunk of stream) {
      if (!isClientConnected) break;
      const content = chunk.choices[0]?.delta?.content || "";
      if (content) {
        fullResponse += content;
        res.write(`data: ${JSON.stringify({ chunk: content })}\n\n`);
      }
    }

    // Persist new response
    if (fullResponse) {
      conversation.messages.push({
        role: "assistant",
        content: fullResponse
      });
      await conversation.save();
    }

    res.write("data: [DONE]\n\n");
    res.end();
  } catch (err) {
    console.error("Regenerate streaming error:", err);
    if (!res.headersSent) {
      return res.status(500).json({ error: err.message || "Failed to regenerate" });
    }
    res.write(`data: ${JSON.stringify({ error: err.message || "Streaming failed" })}\n\n`);
    res.end();
  }
});

export default router;
