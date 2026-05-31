import "dotenv/config";

export type ServerConfig = {
  host: string;
  port: number;
  openAiApiKey?: string;
  openAiModel: string;
  llmTimeoutMs: number;
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  return {
    host: env.HOST ?? "0.0.0.0",
    port: Number.parseInt(env.PORT ?? "8787", 10),
    openAiApiKey: env.OPENAI_API_KEY || undefined,
    openAiModel: env.OPENAI_MODEL ?? "gpt-4o-mini",
    llmTimeoutMs: Number.parseInt(env.LLM_TIMEOUT_MS ?? "8000", 10),
  };
}
