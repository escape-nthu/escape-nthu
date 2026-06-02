import type { FastifyInstance } from "fastify";
import { ApiError, assertString } from "../errors";
import type { PlayerRole } from "../types";
import { InMemoryRoomStore } from "../realtime/room-state";
import { RoomGateway } from "../realtime/websocket";

type RoomRouteDeps = {
  store: InMemoryRoomStore;
  gateway: RoomGateway;
};

export async function registerRoomRoutes(app: FastifyInstance, deps: RoomRouteDeps): Promise<void> {
  app.post("/api/rooms", async (request) => {
    const body = request.body as { preferredRole?: unknown } | undefined;
    const result = deps.store.createRoom(parseRole(body?.preferredRole) ?? "A");

    return {
      roomId: result.roomId,
      playerId: result.player.playerId,
      role: result.player.role,
      state: result.state,
    };
  });

  app.get("/api/rooms/:roomId", async (request) => {
    const { roomId } = request.params as { roomId: string };
    return deps.store.snapshot(roomId);
  });

  app.post("/api/rooms/:roomId/join", async (request) => {
    const { roomId } = request.params as { roomId: string };
    const body = request.body as { preferredRole?: unknown } | undefined;
    const result = deps.store.joinRoom(roomId, parseRole(body?.preferredRole));

    deps.gateway.broadcast(result.roomId, {
      type: "room:state",
      payload: result.state,
    });

    return {
      roomId: result.roomId,
      playerId: result.player.playerId,
      role: result.player.role,
      state: result.state,
    };
  });

  app.post("/api/rooms/:roomId/clues", async (request) => {
    const { roomId } = request.params as { roomId: string };
    const body = request.body as Record<string, unknown>;
    const playerId = assertString(body?.playerId, "playerId");
    const clueId = assertString(body?.clueId, "clueId");
    const state = deps.store.collectClue(roomId, playerId, clueId);

    deps.gateway.broadcast(roomId, {
      type: "clue:collected",
      payload: { playerId, clueId, state },
    });

    return { clueId, state };
  });
}

function parseRole(value: unknown): PlayerRole | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  if (value !== "A" && value !== "B") {
    throw new ApiError(400, "VALIDATION_ERROR", "preferredRole must be A or B");
  }

  return value;
}
