import type { FastifyInstance, FastifyRequest } from "fastify";
import { WebSocket } from "ws";
import { ApiError, assertString } from "../errors";
import type { ClientEvent, LevelId, ServerEvent, Vector2 } from "../types";
import { InMemoryRoomStore } from "./room-state";

type ConnectionMap = Map<string, Map<string, Set<WebSocket>>>;

const LEVEL_IDS = new Set<LevelId>(["level-01", "level-02", "level-03"]);

export class RoomGateway {
  private readonly connections: ConnectionMap = new Map();

  constructor(private readonly store: InMemoryRoomStore) {}

  register(app: FastifyInstance): void {
    app.get("/ws", { websocket: true }, (socket, request) => {
      this.handleConnection(socket, request);
    });
  }

  broadcast(roomId: string, event: ServerEvent, exceptSocket?: WebSocket): void {
    const roomConnections = this.connections.get(roomId.toUpperCase());
    if (!roomConnections) {
      return;
    }

    const payload = JSON.stringify(event);
    for (const sockets of roomConnections.values()) {
      for (const socket of sockets) {
        if (socket !== exceptSocket && socket.readyState === WebSocket.OPEN) {
          socket.send(payload);
        }
      }
    }
  }

  send(socket: WebSocket, event: ServerEvent): void {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(event));
    }
  }

  private handleConnection(socket: WebSocket, request: FastifyRequest): void {
    try {
      const query = request.query as Record<string, unknown>;
      const roomId = assertString(query.roomId, "roomId").toUpperCase();
      const playerId = assertString(query.playerId, "playerId");
      const player = this.store.markConnected(roomId, playerId, true);
      this.addConnection(roomId, playerId, socket);

      this.send(socket, {
        type: "server:welcome",
        payload: { playerId, state: this.store.snapshot(roomId) },
      });
      this.broadcast(roomId, {
        type: "player:connected",
        payload: { playerId, role: player.role },
      }, socket);

      socket.on("message", (rawMessage) => {
        this.handleMessage(roomId, playerId, socket, rawMessage.toString());
      });

      socket.on("close", () => {
        this.removeConnection(roomId, playerId, socket);
        const disconnected = this.store.markConnected(roomId, playerId, false);
        this.broadcast(roomId, {
          type: "player:disconnected",
          payload: { playerId, role: disconnected.role },
        });
      });
    } catch (error) {
      this.send(socket, toSocketError(error));
      socket.close();
    }
  }

  private handleMessage(roomId: string, playerId: string, socket: WebSocket, rawMessage: string): void {
    try {
      const event = JSON.parse(rawMessage) as ClientEvent;
      if (!event || typeof event.type !== "string") {
        throw new ApiError(400, "INVALID_EVENT", "Event type is required");
      }

      switch (event.type) {
        case "ping":
          this.send(socket, { type: "pong", payload: { at: new Date().toISOString() } });
          return;
        case "player:position": {
          const position = parseVector2(event.payload?.position);
          this.store.updatePosition(roomId, playerId, position);
          this.broadcast(roomId, {
            type: "player:position",
            payload: {
              playerId,
              position,
              direction: event.payload.direction,
              animation: event.payload.animation,
            },
          }, socket);
          return;
        }
        case "clue:collect": {
          const clueId = assertString(event.payload?.clueId, "clueId");
          const state = this.store.collectClue(roomId, playerId, clueId);
          this.broadcast(roomId, {
            type: "clue:collected",
            payload: { playerId, clueId, state },
          });
          return;
        }
        case "level:complete": {
          const levelId = assertLevelId(event.payload?.levelId);
          const state = this.store.completeLevel(roomId, playerId, levelId);
          this.broadcast(roomId, {
            type: "level:completed",
            payload: { playerId, levelId, state },
          });
          return;
        }
        case "ghost:update":
          this.broadcast(roomId, {
            type: "ghost:state",
            payload: { ...event.payload, playerId },
          }, socket);
          return;
        default:
          throw new ApiError(400, "UNKNOWN_EVENT", `Unsupported event type: ${(event as { type: string }).type}`);
      }
    } catch (error) {
      this.send(socket, toSocketError(error));
    }
  }

  private addConnection(roomId: string, playerId: string, socket: WebSocket): void {
    const normalizedRoomId = roomId.toUpperCase();
    const roomConnections = this.connections.get(normalizedRoomId) ?? new Map<string, Set<WebSocket>>();
    const playerConnections = roomConnections.get(playerId) ?? new Set<WebSocket>();
    playerConnections.add(socket);
    roomConnections.set(playerId, playerConnections);
    this.connections.set(normalizedRoomId, roomConnections);
  }

  private removeConnection(roomId: string, playerId: string, socket: WebSocket): void {
    const roomConnections = this.connections.get(roomId.toUpperCase());
    const playerConnections = roomConnections?.get(playerId);
    playerConnections?.delete(socket);

    if (playerConnections?.size === 0) {
      roomConnections?.delete(playerId);
    }
    if (roomConnections?.size === 0) {
      this.connections.delete(roomId.toUpperCase());
    }
  }
}

function parseVector2(value: unknown): Vector2 {
  if (!value || typeof value !== "object") {
    throw new ApiError(400, "VALIDATION_ERROR", "position is required");
  }

  const maybeVector = value as Record<string, unknown>;
  if (typeof maybeVector.x !== "number" || typeof maybeVector.y !== "number") {
    throw new ApiError(400, "VALIDATION_ERROR", "position.x and position.y must be numbers");
  }

  return { x: maybeVector.x, y: maybeVector.y };
}

function assertLevelId(value: unknown): LevelId {
  if (typeof value !== "string" || !LEVEL_IDS.has(value as LevelId)) {
    throw new ApiError(400, "VALIDATION_ERROR", "levelId must be level-01, level-02, or level-03");
  }

  return value as LevelId;
}

function toSocketError(error: unknown): ServerEvent {
  if (error instanceof ApiError) {
    return { type: "error", payload: { code: error.code, message: error.message } };
  }

  return { type: "error", payload: { code: "INTERNAL_ERROR", message: "Unexpected websocket error" } };
}
