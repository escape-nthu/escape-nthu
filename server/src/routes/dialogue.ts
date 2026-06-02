import type { FastifyInstance } from "fastify";
import { assertString } from "../errors";
import { NpcService } from "../ai/npc-service";
import { InMemoryRoomStore } from "../realtime/room-state";
import { RoomGateway } from "../realtime/websocket";

type DialogueRouteDeps = {
  store: InMemoryRoomStore;
  gateway: RoomGateway;
  npcService: NpcService;
};

export async function registerDialogueRoutes(app: FastifyInstance, deps: DialogueRouteDeps): Promise<void> {
  app.post("/api/dialogue", async (request) => {
    const body = request.body as Record<string, unknown>;
    const roomId = assertString(body?.roomId, "roomId");
    const playerId = assertString(body?.playerId, "playerId");
    const npcId = assertString(body?.npcId, "npcId");
    const message = assertString(body?.message, "message");
    const visibleClueIds = Array.isArray(body?.visibleClueIds)
      ? body.visibleClueIds.filter((clueId): clueId is string => typeof clueId === "string")
      : [];

    deps.store.getPlayer(roomId, playerId);
    const turn = deps.store.nextDialogueTurn(roomId, npcId);
    const npcReply = await deps.npcService.reply({ npcId, message, visibleClueIds, turn });

    let completedLevelId: "level-03" | undefined;
    let state = deps.store.snapshot(roomId);

    for (const clueId of npcReply.revealedClueIds) {
      state = deps.store.collectClue(roomId, playerId, clueId);
    }

    if (npcReply.shouldCompleteLevel) {
      state = deps.store.completeLevel(roomId, playerId, "level-03");
      completedLevelId = "level-03";
      deps.gateway.broadcast(roomId, {
        type: "level:completed",
        payload: { playerId, levelId: "level-03", state },
      });
    } else if (npcReply.revealedClueIds.length > 0) {
      deps.gateway.broadcast(roomId, {
        type: "room:state",
        payload: state,
      });
    }

    return {
      npcId,
      reply: npcReply.reply,
      source: npcReply.source,
      hintTier: npcReply.hintTier,
      revealedClueIds: npcReply.revealedClueIds,
      completedLevelId,
      state,
    };
  });
}
