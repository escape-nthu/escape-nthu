import type { ServerConfig } from "../config";
import { buildScriptedFallback } from "./fallback-hints";
import { buildNpcPrompt } from "./prompt-builder";

export type NpcReply = {
  npcId: string;
  reply: string;
  source: "llm" | "fallback";
  hintTier: number;
  revealedClueIds: string[];
  shouldCompleteLevel: boolean;
};

type OpenAiChatResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

export class NpcService {
  constructor(private readonly config: Pick<ServerConfig, "openAiApiKey" | "openAiModel" | "llmTimeoutMs">) {}

  async reply(input: {
    npcId: string;
    message: string;
    visibleClueIds: string[];
    turn: number;
  }): Promise<NpcReply> {
    const fallback = buildScriptedFallback(input);

    if (!this.config.openAiApiKey) {
      return {
        npcId: input.npcId,
        source: "fallback",
        ...fallback,
      };
    }

    try {
      const llmReply = await this.callOpenAi(input);
      return {
        npcId: input.npcId,
        reply: llmReply,
        source: "llm",
        hintTier: fallback.hintTier,
        revealedClueIds: fallback.revealedClueIds,
        shouldCompleteLevel: fallback.shouldCompleteLevel,
      };
    } catch {
      return {
        npcId: input.npcId,
        source: "fallback",
        ...fallback,
      };
    }
  }

  private async callOpenAi(input: { npcId: string; message: string; visibleClueIds: string[] }): Promise<string> {
    const prompt = buildNpcPrompt(input);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.llmTimeoutMs);

    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        signal: controller.signal,
        headers: {
          authorization: `Bearer ${this.config.openAiApiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: this.config.openAiModel,
          messages: [
            { role: "system", content: prompt.system },
            { role: "user", content: prompt.user },
          ],
          temperature: 0.4,
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI request failed with ${response.status}`);
      }

      const body = (await response.json()) as OpenAiChatResponse;
      const content = body.choices?.[0]?.message?.content?.trim();
      if (!content) {
        throw new Error("OpenAI response did not include content");
      }

      return content;
    } finally {
      clearTimeout(timeout);
    }
  }
}
