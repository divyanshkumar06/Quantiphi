import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
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
 * Creates an OpenAI chat completion stream with dynamic tone instructions
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
    model: "gpt-4o-mini", // Fast, highly capable, cost-effective
    messages,
    stream: true
  });
};
