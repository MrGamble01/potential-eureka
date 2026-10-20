export type LlmProviderId = "stub" | "openai" | "anthropic";
export type ImageProviderId = "stub" | "http";

export type AppConfig = {
  llmProvider: LlmProviderId;
  imageProvider: ImageProviderId;
  openaiApiKey: string;
  openaiModel: string;
  anthropicApiKey: string;
  anthropicModel: string;
  imageApiKey: string;
  imageApiUrl: string;
  databaseUrl: string;
  port: number;
};

const LLM_IDS: readonly LlmProviderId[] = ["stub", "openai", "anthropic"];
const IMAGE_IDS: readonly ImageProviderId[] = ["stub", "http"];

function pick<T extends string>(value: string | undefined, allowed: readonly T[], fallback: T, name: string): T {
  const trimmed = (value ?? "").trim();
  const chosen = (trimmed || fallback) as T;
  if (!allowed.includes(chosen)) {
    throw new Error(`${name} must be one of ${allowed.join(", ")}. Received "${trimmed}".`);
  }
  return chosen;
}

function defaultEnv(): Record<string, string | undefined> {
  const proc = globalThis as { process?: { env?: Record<string, string | undefined> } };
  return proc.process?.env ?? {};
}

export function loadConfig(env: Record<string, string | undefined> = defaultEnv()): AppConfig {
  const portRaw = (env.PORT ?? "").trim();
  const port = portRaw ? Number(portRaw) : 8787;
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT must be an integer between 1 and 65535.");
  }
  return {
    llmProvider: pick(env.LLM_PROVIDER, LLM_IDS, "stub", "LLM_PROVIDER"),
    imageProvider: pick(env.IMAGE_PROVIDER, IMAGE_IDS, "stub", "IMAGE_PROVIDER"),
    openaiApiKey: (env.OPENAI_API_KEY ?? "").trim(),
    openaiModel: (env.OPENAI_MODEL ?? "").trim() || "gpt-4o-mini",
    anthropicApiKey: (env.ANTHROPIC_API_KEY ?? "").trim(),
    anthropicModel: (env.ANTHROPIC_MODEL ?? "").trim() || "claude-3-5-sonnet-latest",
    imageApiKey: (env.IMAGE_API_KEY ?? "").trim(),
    imageApiUrl: (env.IMAGE_API_URL ?? "").trim(),
    databaseUrl: (env.DATABASE_URL ?? "").trim() || "file:./data/ashmarch.sqlite",
    port,
  };
}

export function sqlitePathFromUrl(databaseUrl: string): string {
  return databaseUrl.replace(/^file:/, "");
}
