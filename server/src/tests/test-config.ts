import type { ServerConfig } from "../config";

export const testConfig: ServerConfig = {
  host: "127.0.0.1",
  port: 0,
  openAiApiKey: undefined,
  openAiModel: "test-model",
  llmTimeoutMs: 50,
};
