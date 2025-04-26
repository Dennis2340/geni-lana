import {
  customProvider,
  extractReasoningMiddleware,
  wrapLanguageModel,
} from "ai";
import { createOpenAI } from "@ai-sdk/openai";

// Using import.meta.env for client-side environment variables
const apiKey = import.meta.env.VITE_OPENAI_API_KEY;

// Check if API key exists and log a warning if it doesn't
if (!apiKey) {
  console.warn("⚠️ OpenAI API key is not set. AI features may not work properly.");
}

const openai = createOpenAI({
  apiKey: apiKey,
});

export const myProvider = customProvider({
  languageModels: {   
    // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
    "chat-model": openai("gpt-4o"),
    "chat-model-reasoning": wrapLanguageModel({
      model: openai("gpt-3.5-turbo"),
      middleware: extractReasoningMiddleware({ tagName: "think" }),
    }),
    "title-model": openai("gpt-3.5-turbo"),
    "artifact-model": openai("gpt-4o"),
  },
  imageModels: {
    "small-model": openai.image("dall-e-3"),
  },
});
