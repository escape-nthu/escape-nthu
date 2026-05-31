import { randomUUID } from "node:crypto";
import { ApiError } from "../errors";
import type { LevelId, PlayerRole, PlayerState, RoomStateSnapshot, Vector2 } from "../types";

type Room = {
  roomId: string;
  createdAt: string;
  updatedAt: string;
  players: Map<string, PlayerState>;
  completedLevels: Set<LevelId>;
  collectedClues: Set<string>;
  puzzleAttempts: Map<string, number>;
  motionChallenge: {
    targetCount: number;
    bestCount: number;
    completed: boolean;
  };
  dialogueTurns: Map<string, number>;
};

const ROOM_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const ALL_LEVELS: LevelId[] = ["level-01", "level-02", "level-03"];

export class InMemoryRoomStore {
  private readonly rooms = new Map<string, Room>();

  createRoom(preferredRole: PlayerRole = "A"): { roomId: string; player: PlayerState; state: RoomStateSnapshot } {
    const now = new Date().toISOString();
    const room: Room = {
      roomId: this.generateRoomId(),
      createdAt: now,
      updatedAt: now,
      players: new Map(),
      completedLevels: new Set(),
      collectedClues: new Set(),
      puzzleAttempts: new Map(),
      motionChallenge: {
        targetCount: 10,
        bestCount: 0,
        completed: false,
      },
      dialogueTurns: new Map(),
    };

    const player = this.createPlayer(preferredRole);
    room.players.set(player.playerId, player);
    this.rooms.set(room.roomId, room);

    return { roomId: room.roomId, player, state: this.snapshot(room.roomId) };
  }

  joinRoom(
    roomId: string,
    preferredRole?: PlayerRole,
  ): { roomId: string; player: PlayerState; state: RoomStateSnapshot } {
    const room = this.requireRoom(roomId);
    const role = this.pickAvailableRole(room, preferredRole);
    const player = this.createPlayer(role);
    room.players.set(player.playerId, player);
    this.touch(room);

    return { roomId: room.roomId, player, state: this.snapshot(room.roomId) };
  }

  getPlayer(roomId: string, playerId: string): PlayerState {
    const room = this.requireRoom(roomId);
    const player = room.players.get(playerId);
    if (!player) {
      throw new ApiError(404, "PLAYER_NOT_FOUND", "Player does not belong to this room");
    }

    return player;
  }

  markConnected(roomId: string, playerId: string, connected: boolean): PlayerState {
    const room = this.requireRoom(roomId);
    const player = this.getPlayer(roomId, playerId);
    player.connected = connected;
    player.lastSeenAt = new Date().toISOString();
    this.touch(room);
    return player;
  }

  updatePosition(roomId: string, playerId: string, position: Vector2): RoomStateSnapshot {
    const room = this.requireRoom(roomId);
    const player = this.getPlayer(roomId, playerId);
    player.position = position;
    player.lastSeenAt = new Date().toISOString();
    this.touch(room);
    return this.snapshot(roomId);
  }

  collectClue(roomId: string, playerId: string, clueId: string): RoomStateSnapshot {
    const room = this.requireRoom(roomId);
    this.getPlayer(roomId, playerId);
    room.collectedClues.add(clueId);
    this.touch(room);
    return this.snapshot(roomId);
  }

  incrementPuzzleAttempt(roomId: string, puzzleId: string): number {
    const room = this.requireRoom(roomId);
    const next = (room.puzzleAttempts.get(puzzleId) ?? 0) + 1;
    room.puzzleAttempts.set(puzzleId, next);
    this.touch(room);
    return next;
  }

  completeLevel(roomId: string, playerId: string, levelId: LevelId): RoomStateSnapshot {
    const room = this.requireRoom(roomId);
    this.getPlayer(roomId, playerId);
    room.completedLevels.add(levelId);
    this.touch(room);
    return this.snapshot(roomId);
  }

  completeMotion(roomId: string, playerId: string, count: number): RoomStateSnapshot {
    const room = this.requireRoom(roomId);
    this.getPlayer(roomId, playerId);
    room.motionChallenge.bestCount = Math.max(room.motionChallenge.bestCount, count);
    if (count >= room.motionChallenge.targetCount) {
      room.motionChallenge.completed = true;
      room.completedLevels.add("level-02");
    }
    this.touch(room);
    return this.snapshot(roomId);
  }

  nextDialogueTurn(roomId: string, npcId: string): number {
    const room = this.requireRoom(roomId);
    const next = (room.dialogueTurns.get(npcId) ?? 0) + 1;
    room.dialogueTurns.set(npcId, next);
    this.touch(room);
    return next;
  }

  snapshot(roomId: string): RoomStateSnapshot {
    const room = this.requireRoom(roomId);

    return {
      roomId: room.roomId,
      createdAt: room.createdAt,
      updatedAt: room.updatedAt,
      players: [...room.players.values()].sort((a, b) => a.role.localeCompare(b.role)),
      completedLevels: [...room.completedLevels].sort(),
      collectedClues: [...room.collectedClues].sort(),
      puzzleAttempts: Object.fromEntries([...room.puzzleAttempts.entries()].sort(([a], [b]) => a.localeCompare(b))),
      motionChallenge: { ...room.motionChallenge },
      escaped: ALL_LEVELS.every((levelId) => room.completedLevels.has(levelId)),
    };
  }

  hasRoom(roomId: string): boolean {
    return this.rooms.has(roomId.toUpperCase());
  }

  private requireRoom(roomId: string): Room {
    const normalizedRoomId = roomId.toUpperCase();
    const room = this.rooms.get(normalizedRoomId);
    if (!room) {
      throw new ApiError(404, "ROOM_NOT_FOUND", "Room not found");
    }

    return room;
  }

  private createPlayer(role: PlayerRole): PlayerState {
    return {
      playerId: `p_${randomUUID().slice(0, 8)}`,
      role,
      connected: true,
      lastSeenAt: new Date().toISOString(),
    };
  }

  private pickAvailableRole(room: Room, preferredRole?: PlayerRole): PlayerRole {
    const occupied = new Set([...room.players.values()].map((player) => player.role));
    const candidates: PlayerRole[] = preferredRole ? [preferredRole, preferredRole === "A" ? "B" : "A"] : ["A", "B"];
    const role = candidates.find((candidate) => !occupied.has(candidate));
    if (!role) {
      throw new ApiError(409, "ROOM_FULL", "Room already has two players");
    }

    return role;
  }

  private generateRoomId(): string {
    for (let attempt = 0; attempt < 32; attempt += 1) {
      const roomId = Array.from({ length: 4 }, () => ROOM_ALPHABET[Math.floor(Math.random() * ROOM_ALPHABET.length)]).join("");
      if (!this.rooms.has(roomId)) {
        return roomId;
      }
    }

    throw new ApiError(500, "ROOM_ID_EXHAUSTED", "Could not allocate a room id");
  }

  private touch(room: Room): void {
    room.updatedAt = new Date().toISOString();
  }
}
