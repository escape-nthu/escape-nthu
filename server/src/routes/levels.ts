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
    const accepted = (motionType === "raised-hands" || motionType === "hands-raised") && count >= 0 && confidence >= 0;
    const state = accepted ? deps.store.completeMotion(roomId, playerId, count) : deps.store.snapshot(roomId);

    if (accepted) {
      deps.gateway.broadcast(roomId, state.gestureChallenge.completed
        ? {
            type: "level:completed",
            payload: { playerId, levelId: "level-03", state },
          }
        : {
            type: "room:state",
            payload: state,
          });
    }

    return {
      completedLevelId: state.gestureChallenge.completed ? "level-03" : undefined,
      accepted,
      targetCount: state.gestureChallenge.targetCount,
      bestCount: state.gestureChallenge.players[playerId]?.count ?? 0,
      state,
    };
  });

  app.post("/api/levels/gesture/progress", async (request) => {
    const body = request.body as Record<string, unknown>;
    const roomId = assertString(body?.roomId, "roomId");
    const playerId = assertString(body?.playerId, "playerId");
    const count = assertNumber(body?.count, "count");
    const confidence = typeof body?.confidence === "number" ? body.confidence : 1;
    const state = deps.store.updateGestureProgress(roomId, playerId, count, confidence);

    deps.gateway.broadcast(roomId, {
      type: "room:state",
      payload: state,
    });

    return {
      accepted: true,
      targetCount: state.gestureChallenge.targetCount,
      playerProgress: state.gestureChallenge.players[playerId],
      state,
    };
  });

  app.post("/api/levels/gesture/ready", async (request) => {
    const body = request.body as Record<string, unknown>;
    const roomId = assertString(body?.roomId, "roomId");
    const playerId = assertString(body?.playerId, "playerId");
    const confidence = typeof body?.confidence === "number" ? body.confidence : 1;
    const state = deps.store.markGestureReady(roomId, playerId, confidence);

    deps.gateway.broadcast(roomId, state.gestureChallenge.completed
      ? {
          type: "level:completed",
          payload: { playerId, levelId: "level-03", state },
        }
      : {
          type: "room:state",
          payload: state,
        });

    return {
      accepted: true,
      completedLevelId: state.gestureChallenge.completed ? "level-03" : undefined,
      state,
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
