import type { FastifyInstance } from "fastify";
import { assertString } from "../errors";
import { getPuzzle, listPublicPuzzles, toPublicPuzzle } from "../puzzles/puzzle-registry";
import { verifyPuzzleAnswer } from "../puzzles/verifier";
import { InMemoryRoomStore } from "../realtime/room-state";
import { RoomGateway } from "../realtime/websocket";

type PuzzleRouteDeps = {
  store: InMemoryRoomStore;
  gateway: RoomGateway;
};

export async function registerPuzzleRoutes(app: FastifyInstance, deps: PuzzleRouteDeps): Promise<void> {
  app.get("/api/puzzles", async () => ({
    puzzles: listPublicPuzzles(),
  }));

  app.get("/api/puzzles/:puzzleId", async (request, reply) => {
    const { puzzleId } = request.params as { puzzleId: string };
    const puzzle = getPuzzle(puzzleId);
    if (!puzzle) {
      return reply.code(404).send({ error: { code: "PUZZLE_NOT_FOUND", message: "Puzzle not found" } });
    }

    return toPublicPuzzle(puzzle);
  });

  app.post("/api/puzzles/:puzzleId/submit", async (request) => {
    const { puzzleId } = request.params as { puzzleId: string };
    const body = request.body as Record<string, unknown>;
    const roomId = assertString(body?.roomId, "roomId");
    const playerId = assertString(body?.playerId, "playerId");
    const answer = assertString(body?.answer, "answer");

    deps.store.getPlayer(roomId, playerId);
    const attempts = deps.store.incrementPuzzleAttempt(roomId, puzzleId);
    const verification = verifyPuzzleAnswer(puzzleId, answer);

    if (verification.status === "AC" && verification.completedLevelId === "level-01") {
      const state = deps.store.completeLevel(roomId, playerId, "level-01");
      deps.gateway.broadcast(roomId, {
        type: "level:completed",
        payload: { playerId, levelId: "level-01", state },
      });
    }

    return {
      ...verification,
      attempts,
    };
  });
}
