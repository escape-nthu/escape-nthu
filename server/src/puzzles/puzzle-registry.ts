import levelOnePuzzle from "./fixtures/level-01-algorithm.json";
import type { LevelId } from "../types";

export type PuzzleDefinition = {
  id: string;
  levelId: LevelId;
  title: string;
  description: string;
  prompt: string;
  acceptedAnswers: string[];
  publicHints: string[];
};

export type PublicPuzzleDefinition = Omit<PuzzleDefinition, "acceptedAnswers">;

const puzzles = new Map<string, PuzzleDefinition>([
  [levelOnePuzzle.id, levelOnePuzzle as PuzzleDefinition],
]);

export function getPuzzle(puzzleId: string): PuzzleDefinition | undefined {
  return puzzles.get(puzzleId);
}

export function listPublicPuzzles(): PublicPuzzleDefinition[] {
  return [...puzzles.values()].map(toPublicPuzzle);
}

export function toPublicPuzzle(puzzle: PuzzleDefinition): PublicPuzzleDefinition {
  const { acceptedAnswers: _acceptedAnswers, ...publicPuzzle } = puzzle;
  return publicPuzzle;
}
