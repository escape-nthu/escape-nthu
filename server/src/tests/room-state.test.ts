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
});
