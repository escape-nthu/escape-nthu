import { randomUUID } from "node:crypto";
import { ApiError } from "../errors";
import type {
  GestureChallengeSnapshot,
  GesturePlayerProgress,
  LevelId,
  PlayerRole,
  PlayerState,
  RoomStateSnapshot,
  Vector2,
} from "../types";

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
  gestureChallenge: {
    targetCount: number;
    syncWindowMs: number;
    players: Map<string, GesturePlayerProgress>;
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
      gestureChallenge: {
        targetCount: 5,
        syncWindowMs: 3000,
        players: new Map(),
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
    const state = this.updateGestureProgress(roomId, playerId, count, 1);
    const room = this.requireRoom(roomId);
    room.motionChallenge.bestCount = Math.max(room.motionChallenge.bestCount, count);
    if (state.gestureChallenge.completed) {
      room.motionChallenge.completed = true;
    }
    this.touch(room);
    return this.snapshot(roomId);
  }

  updateGestureProgress(roomId: string, playerId: string, count: number, confidence: number): RoomStateSnapshot {
    const room = this.requireRoom(roomId);
    this.getPlayer(roomId, playerId);
    const previous = room.gestureChallenge.players.get(playerId);
    const nextCount = Math.max(previous?.count ?? 0, Math.floor(count));
    room.gestureChallenge.players.set(playerId, {
      count: nextCount,
      confidence,
      readyAt: previous?.readyAt,
    });
    this.touch(room);
    return this.snapshot(roomId);
  }

  markGestureReady(roomId: string, playerId: string, confidence: number, readyAt = new Date()): RoomStateSnapshot {
    const room = this.requireRoom(roomId);
    this.getPlayer(roomId, playerId);

    const previous = room.gestureChallenge.players.get(playerId);
    room.gestureChallenge.players.set(playerId, {
      count: previous?.count ?? 0,
      confidence,
      readyAt: readyAt.toISOString(),
    });

    this.resolveGestureCompletion(room, readyAt);
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
      gestureChallenge: this.snapshotGestureChallenge(room),
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

  private resolveGestureCompletion(room: Room, now: Date): void {
    if (room.gestureChallenge.completed) {
      return;
    }

    const activePlayers = [...room.players.keys()];
    if (activePlayers.length < 2) {
      return;
    }

    const readyPlayers = activePlayers
      .map((playerId) => room.gestureChallenge.players.get(playerId))
      .filter((progress): progress is GesturePlayerProgress => {
        if (!progress || !progress.readyAt) {
          return false;
        }
        return progress.count >= room.gestureChallenge.targetCount;
      });

    if (readyPlayers.length < 2) {
      return;
    }

    const readyTimes = readyPlayers.map((progress) => Date.parse(progress.readyAt ?? ""));
    const validTimes = readyTimes.filter((time) => Number.isFinite(time));
    if (validTimes.length < 2) {
      return;
    }

    const earliest = Math.min(...validTimes);
    const latest = Math.max(...validTimes);
    if (latest - earliest <= room.gestureChallenge.syncWindowMs) {
      room.gestureChallenge.completed = true;
      room.motionChallenge.completed = true;
      room.completedLevels.add("level-03");
      return;
    }

    for (const playerId of activePlayers) {
      const progress = room.gestureChallenge.players.get(playerId);
      if (!progress?.readyAt) continue;
      if (now.getTime() - Date.parse(progress.readyAt) > room.gestureChallenge.syncWindowMs) {
        room.gestureChallenge.players.set(playerId, {
          count: progress.count,
          confidence: progress.confidence,
        });
      }
    }
  }

  private snapshotGestureChallenge(room: Room): GestureChallengeSnapshot {
    return {
      targetCount: room.gestureChallenge.targetCount,
      syncWindowMs: room.gestureChallenge.syncWindowMs,
      players: Object.fromEntries(
        [...room.gestureChallenge.players.entries()].sort(([a], [b]) => a.localeCompare(b)),
      ),
      completed: room.gestureChallenge.completed,
    };
  }
}
