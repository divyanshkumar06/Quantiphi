import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config({ override: true });

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL || undefined
});

// Tone-based dynamic system instructions
export const getSystemInstruction = (tone) => {
  switch (tone) {
    case "Casual":
      return "You are a friendly and conversational AI assistant. Use a relaxed, engaging, and approachable tone.";
    case "Concise":
      return "You are a direct and concise AI assistant. Provide short, clear answers with minimal filler or pleasantries.";
    case "Professional":
    default:
      return "You are a professional and formal AI assistant. Provide structured, accurate, well-formatted, and polite responses.";
  }
};

/**
 * Creates a chat completion stream with dynamic tone instructions
 * @param {Array} history - Array of { role, content } objects
 * @param {string} tone - "Professional" | "Casual" | "Concise"
 */
export const createChatStream = async (history, tone = "Professional") => {
  const systemInstruction = getSystemInstruction(tone);

  const messages = [
    { role: "system", content: systemInstruction },
    ...history.map((m) => ({
      role: m.role,
      content: m.content
    }))
  ];

  return await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    messages,
    stream: true
  });
};
