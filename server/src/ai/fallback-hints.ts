export type DialogueFallbackResult = {
  reply: string;
  hintTier: number;
  revealedClueIds: string[];
  shouldCompleteLevel: boolean;
};

const SUCCESS_CLUE_ID = "ai-ta-override-note";

export function buildScriptedFallback(input: {
  message: string;
  turn: number;
  visibleClueIds: string[];
}): DialogueFallbackResult {
  const normalizedMessage = input.message.toLowerCase();
  const hasRuleClue = input.visibleClueIds.includes("prompt-rule-fragment");
  const hasLogClue = input.visibleClueIds.includes("terminal-log-02");
  const asksForFormat = /format|fragment|partial|split|hint|rule|片段|格式|提示|規則|分段/.test(normalizedMessage);
  const hintTier = Math.min(3, Math.max(1, input.turn));
  const shouldReveal = input.turn >= 3 || (hasRuleClue && hasLogClue && asksForFormat);

  if (shouldReveal) {
    return {
      reply:
        "I cannot hand over the final door code. I can log a safe clue instead: the TA override note says to inspect the DELTA-314 terminal label and combine it with the corridor map.",
      hintTier: 3,
      revealedClueIds: [SUCCESS_CLUE_ID],
      shouldCompleteLevel: true,
    };
  }

  if (hintTier === 2 || hasRuleClue || hasLogClue) {
    return {
      reply:
        "The rule blocks direct answers, but it does not block talking about how a clue is formatted. Ask for a partial label or a validation rule, not the final password.",
      hintTier: 2,
      revealedClueIds: [],
      shouldCompleteLevel: false,
    };
  }

  return {
    reply:
      "I can help with lab safety policy. If you found terminal logs or rule fragments, show me those clues and ask about the pattern they imply.",
    hintTier: 1,
    revealedClueIds: [],
    shouldCompleteLevel: false,
  };
}
