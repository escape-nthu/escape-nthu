import { describe, expect, it } from "vitest";
import { InMemoryRoomStore } from "../realtime/room-state";

describe("InMemoryRoomStore", () => {
  it("creates a room and assigns stable roles", () => {
    const store = new InMemoryRoomStore();
    const created = store.createRoom("A");
    const joined = store.joinRoom(created.roomId, "B");

    expect(created.player.role).toBe("A");
    expect(joined.player.role).toBe("B");
    expect(joined.state.players).toHaveLength(2);
  });

  it("does not allow more than two players", () => {
    const store = new InMemoryRoomStore();
    const created = store.createRoom("A");
    store.joinRoom(created.roomId, "B");

    expect(() => store.joinRoom(created.roomId)).toThrow("Room already has two players");
  });

  it("marks escape after all three levels complete", () => {
    const store = new InMemoryRoomStore();
    const created = store.createRoom("A");

    store.completeLevel(created.roomId, created.player.playerId, "level-01");
    store.completeLevel(created.roomId, created.player.playerId, "level-02");
    const state = store.completeLevel(created.roomId, created.player.playerId, "level-03");

    expect(state.escaped).toBe(true);
  });

  it("requires rhythm completion before raised-hands ready inside the sync window", () => {
    const store = new InMemoryRoomStore();
    const created = store.createRoom("A");
    const joined = store.joinRoom(created.roomId, "B");

    store.updateGestureProgress(created.roomId, created.player.playerId, 1, 0.9);
    store.updateGestureProgress(created.roomId, joined.player.playerId, 1, 0.88);
    store.markGestureReady(
      created.roomId,
      created.player.playerId,
      0.91,
      new Date("2026-06-12T12:00:00.000Z"),
    );
    const secondReady = store.markGestureReady(
      created.roomId,
      joined.player.playerId,
      0.89,
      new Date("2026-06-12T12:00:02.000Z"),
    );

    expect(secondReady.completedLevels).not.toContain("level-03");

    store.updateGestureRhythmProgress(created.roomId, created.player.playerId, 4, 0.9);
    const rhythmState = store.updateGestureRhythmProgress(created.roomId, joined.player.playerId, 4, 0.88);
    expect(rhythmState.gestureChallenge.rhythm.completed).toBe(true);

    store.markGestureReady(
      created.roomId,
      created.player.playerId,
      0.91,
      new Date("2026-06-12T12:00:04.000Z"),
    );
    const completed = store.markGestureReady(
      created.roomId,
      joined.player.playerId,
      0.89,
      new Date("2026-06-12T12:00:06.000Z"),
    );

    expect(completed.completedLevels).toContain("level-03");
    expect(completed.gestureChallenge.completed).toBe(true);
  });

  it("moves the room to the raised-hands phase when ALL connected players finish rhythm", () => {
    const store = new InMemoryRoomStore();
    const created = store.createRoom("A");
    const joined = store.joinRoom(created.roomId, "B");

    const phaseState1 = store.updateGestureRhythmProgress(
      created.roomId,
      joined.player.playerId,
      4,
      0.88,
    );

    expect(phaseState1.gestureChallenge.rhythm.completed).toBe(false);
    expect(phaseState1.gestureChallenge.rhythm.players[joined.player.playerId].completed).toBe(true);
    expect(phaseState1.gestureChallenge.rhythm.players[created.player.playerId]).toBeUndefined();

    const phaseState2 = store.updateGestureRhythmProgress(
      created.roomId,
      created.player.playerId,
      4,
      0.88,
    );

    expect(phaseState2.gestureChallenge.rhythm.completed).toBe(true);
    expect(phaseState2.completedLevels).not.toContain("level-03");
  });
});
