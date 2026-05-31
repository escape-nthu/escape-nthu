import type { FastifyInstance } from "fastify";
import { ApiError, assertNumber, assertString } from "../errors";
import type { LevelId } from "../types";
import { InMemoryRoomStore } from "../realtime/room-state";
import { RoomGateway } from "../realtime/websocket";

type LevelRouteDeps = {
  store: InMemoryRoomStore;
  gateway: RoomGateway;
};

const LEVEL_IDS = new Set<LevelId>(["level-01", "level-02", "level-03"]);

export async function registerLevelRoutes(app: FastifyInstance, deps: LevelRouteDeps): Promise<void> {
  app.post("/api/levels/motion/complete", async (request) => {
    const body = request.body as Record<string, unknown>;
    const roomId = assertString(body?.roomId, "roomId");
    const playerId = assertString(body?.playerId, "playerId");
    const motionType = assertString(body?.motionType, "motionType");
    const count = assertNumber(body?.count, "count");
    const confidence = typeof body?.confidence === "number" ? body.confidence : 1;
    const accepted = motionType === "jumping-jack" && count >= 10 && confidence >= 0;
    const state = accepted ? deps.store.completeMotion(roomId, playerId, count) : deps.store.snapshot(roomId);

    if (accepted) {
      deps.gateway.broadcast(roomId, {
        type: "level:completed",
        payload: { playerId, levelId: "level-02", state },
      });
    }

    return {
      completedLevelId: accepted ? "level-02" : undefined,
      accepted,
      targetCount: state.motionChallenge.targetCount,
      bestCount: state.motionChallenge.bestCount,
    };
  });

  app.post("/api/levels/:levelId/complete", async (request) => {
    const { levelId } = request.params as { levelId: string };
    if (!LEVEL_IDS.has(levelId as LevelId)) {
      throw new ApiError(400, "VALIDATION_ERROR", "Unknown levelId");
    }

    const body = request.body as Record<string, unknown>;
    const roomId = assertString(body?.roomId, "roomId");
    const playerId = assertString(body?.playerId, "playerId");
    const state = deps.store.completeLevel(roomId, playerId, levelId as LevelId);

    deps.gateway.broadcast(roomId, {
      type: "level:completed",
      payload: { playerId, levelId: levelId as LevelId, state },
    });

    return { completedLevelId: levelId, state };
  });
}
