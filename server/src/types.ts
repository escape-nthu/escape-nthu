export type PlayerRole = "A" | "B";

export type LevelId = "level-01" | "level-02" | "level-03";

export type PuzzleStatus = "AC" | "WA";

export type Vector2 = {
  x: number;
  y: number;
};

export type PlayerState = {
  playerId: string;
  role: PlayerRole;
  connected: boolean;
  lastSeenAt: string;
  position?: Vector2;
};

export type GesturePlayerProgress = {
  count: number;
  confidence: number;
  readyAt?: string;
  isRaising?: boolean;
};

export type GestureRhythmAction = "nod" | "tilt";

export type GestureRhythmPlayerProgress = {
  step: number;
  confidence: number;
  completed: boolean;
  mistakes: number;
  updatedAt?: string;
};

export type GestureChallengeSnapshot = {
  targetCount: number;
  syncWindowMs: number;
  players: Record<string, GesturePlayerProgress>;
  rhythm: {
    pattern: GestureRhythmAction[];
    targetSteps: number;
    players: Record<string, GestureRhythmPlayerProgress>;
    completed: boolean;
  };
  completed: boolean;
  energy?: number;
};

export type RoomStateSnapshot = {
  roomId: string;
  createdAt: string;
  updatedAt: string;
  players: PlayerState[];
  completedLevels: LevelId[];
  collectedClues: string[];
  puzzleAttempts: Record<string, number>;
  motionChallenge: {
    targetCount: number;
    bestCount: number;
    completed: boolean;
  };
  gestureChallenge: GestureChallengeSnapshot;
  escaped: boolean;
};

export type ServerEvent =
  | { type: "server:welcome"; payload: { playerId: string; state: RoomStateSnapshot } }
  | { type: "room:state"; payload: RoomStateSnapshot }
  | { type: "room:transition"; payload: { targetRoomId: string; arrivalDoorId: string; initiatorId: string } }
  | { type: "player:connected"; payload: { playerId: string; role: PlayerRole } }
  | { type: "player:disconnected"; payload: { playerId: string; role: PlayerRole } }
  | { type: "player:position"; payload: { playerId: string; position: Vector2; direction?: string; animation?: string } }
  | { type: "clue:collected"; payload: { playerId: string; clueId: string; state: RoomStateSnapshot } }
  | { type: "level:completed"; payload: { playerId: string; levelId: LevelId; state: RoomStateSnapshot } }
  | { type: "ghost:state"; payload: Record<string, unknown> }
  | { type: "error"; payload: { code: string; message: string } }
  | { type: "pong"; payload: { at: string } };

export type ClientEvent =
  | { type: "ping" }
  | { type: "player:position"; payload: { position: Vector2; direction?: string; animation?: string } }
  | { type: "clue:collect"; payload: { clueId: string } }
  | { type: "level:complete"; payload: { levelId: LevelId } }
  | { type: "ghost:update"; payload: Record<string, unknown> }
  | { type: "room:transition"; payload: { targetRoomId: string; arrivalDoorId: string } };
