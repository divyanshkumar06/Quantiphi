import express from "express";
import mongoose from "mongoose";
import { Conversation } from "../models/Conversation.js";
import { createChatStream } from "../services/aiService.js";

const router = express.Router();
const ALLOWED_TONES = ["Professional", "Casual", "Concise"];

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
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: "Invalid conversation ID format" });
    }

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
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: "Invalid conversation ID format" });
    }

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

  // Input validation
  if (!message || typeof message !== "string" || !message.trim()) {
    return res.status(400).json({ error: "Valid message text is required" });
  }

  // Sanitize tone against whitelist
  const sanitizedTone = ALLOWED_TONES.includes(tone) ? tone : "Professional";
  const trimmedMessage = message.trim();

  let conversation;

  try {
    // 1. Retrieve or create conversation
    if (conversationId && conversationId !== "new" && mongoose.Types.ObjectId.isValid(conversationId)) {
      conversation = await Conversation.findById(conversationId);
    }

    if (!conversation) {
      // Auto-generate title from the first prompt (up to 35 characters)
      const title = trimmedMessage.slice(0, 35) + (trimmedMessage.length > 35 ? "..." : "");
      conversation = new Conversation({
        title,
        tone: sanitizedTone,
        messages: []
      });
    } else {
      conversation.tone = sanitizedTone;
    }

    // 2. Append user prompt
    conversation.messages.push({
      role: "user",
      content: trimmedMessage
    });
    await conversation.save();

    // 3. Set SSE response headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    if (res.flushHeaders) res.flushHeaders();

    // Send conversationId to client so frontend knows where to bind
    res.write(`data: ${JSON.stringify({ conversationId: conversation._id })}\n\n`);

    // 4. Handle client disconnection (prevent LLM token burn)
    let isClientConnected = true;
    req.on("close", () => {
      isClientConnected = false;
    });

    // 5. Stream from OpenAI
    const stream = await createChatStream(conversation.messages, sanitizedTone);
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
    console.error("Chat streaming error:", err.message);
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
    if (!mongoose.Types.ObjectId.isValid(conversationId)) {
      return res.status(400).json({ error: "Invalid conversation ID format" });
    }

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
    console.error("Regenerate streaming error:", err.message);
    if (!res.headersSent) {
      return res.status(500).json({ error: err.message || "Failed to regenerate" });
    }
    res.write(`data: ${JSON.stringify({ error: err.message || "Streaming failed" })}\n\n`);
    res.end();
  }
});

export default router;
