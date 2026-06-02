import { ApiError } from "../errors";
import type { PuzzleStatus } from "../types";
import { getPuzzle } from "./puzzle-registry";

export type PuzzleVerification = {
  status: PuzzleStatus;
  puzzleId: string;
  completedLevelId?: string;
};

export function verifyPuzzleAnswer(puzzleId: string, answer: string): PuzzleVerification {
  const puzzle = getPuzzle(puzzleId);
  if (!puzzle) {
    throw new ApiError(404, "PUZZLE_NOT_FOUND", "Puzzle not found");
  }

  const normalizedAnswer = normalizeAnswer(answer);
  const accepted = puzzle.acceptedAnswers.some((acceptedAnswer) => normalizeAnswer(acceptedAnswer) === normalizedAnswer);

  return {
    status: accepted ? "AC" : "WA",
    puzzleId,
    completedLevelId: accepted ? puzzle.levelId : undefined,
  };
}

export function normalizeAnswer(answer: string): string {
  return answer.trim().replace(/\s+/g, " ").toLowerCase();
}
