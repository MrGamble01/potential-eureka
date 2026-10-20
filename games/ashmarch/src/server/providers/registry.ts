import type { AppConfig } from "../config";
import { AnthropicLlmProvider, OpenAiLlmProvider } from "./liveLlm";
import { HttpImageProvider } from "./liveImage";
import { StubImageProvider } from "./stubImage";
import { StubLlmProvider } from "./stubLlm";
import type { ImageProvider, LlmProvider } from "./types";

export function createLlmProvider(config: AppConfig): LlmProvider {
  if (config.llmProvider === "stub") return new StubLlmProvider();
  if (config.llmProvider === "openai") {
    if (!config.openaiApiKey) {
      throw new Error("OPENAI_API_KEY is required when LLM_PROVIDER=openai.");
    }
    return new OpenAiLlmProvider({ apiKey: config.openaiApiKey, model: config.openaiModel });
  }
  if (!config.anthropicApiKey) {
    throw new Error("ANTHROPIC_API_KEY is required when LLM_PROVIDER=anthropic.");
  }
  return new AnthropicLlmProvider({ apiKey: config.anthropicApiKey, model: config.anthropicModel });
}

export function createImageProvider(config: AppConfig): ImageProvider {
  if (config.imageProvider === "stub") return new StubImageProvider();
  if (!config.imageApiUrl) {
    throw new Error("IMAGE_API_URL is required when IMAGE_PROVIDER=http.");
  }
  if (!config.imageApiKey) {
    throw new Error("IMAGE_API_KEY is required when IMAGE_PROVIDER=http.");
  }
  return new HttpImageProvider({ apiKey: config.imageApiKey, apiUrl: config.imageApiUrl });
}
