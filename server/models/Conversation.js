import mongoose from "mongoose";

const messageSchema = new mongoose.Schema({
  role: {
    type: String,
    enum: ["user", "assistant"],
    required: true
  },
  content: {
    type: String,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

const conversationSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      default: "New Conversation"
    },
    tone: {
      type: String,
      enum: ["Professional", "Casual", "Concise"],
      default: "Professional"
    },
    messages: [messageSchema]
  },
  {
    timestamps: true // Automatically manages createdAt and updatedAt
  }
);

export const Conversation = mongoose.model("Conversation", conversationSchema);
