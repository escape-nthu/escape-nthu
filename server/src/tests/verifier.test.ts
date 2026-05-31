import { describe, expect, it } from "vitest";
import { normalizeAnswer, verifyPuzzleAnswer } from "../puzzles/verifier";

describe("puzzle verifier", () => {
  it("accepts normalized correct answers", () => {
    expect(verifyPuzzleAnswer("level-01-shortest-path", "  Seven  ")).toMatchObject({
      status: "AC",
      completedLevelId: "level-01",
    });
  });

  it("rejects wrong answers without completing the level", () => {
    expect(verifyPuzzleAnswer("level-01-shortest-path", "8")).toEqual({
      status: "WA",
      puzzleId: "level-01-shortest-path",
      completedLevelId: undefined,
    });
  });

  it("normalizes whitespace and casing", () => {
    expect(normalizeAnswer("  A   B  ")).toBe("a b");
  });
});
