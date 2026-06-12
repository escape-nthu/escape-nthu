import { describe, expect, it } from "vitest";
import { buildApp } from "../app";
import { testConfig } from "./test-config";

describe("HTTP API", () => {
  it("creates and joins a room", async () => {
    const app = await buildApp({ config: testConfig, logger: false });

    const createResponse = await app.inject({
      method: "POST",
      url: "/api/rooms",
      payload: { preferredRole: "A" },
    });
    const created = createResponse.json();

    const joinResponse = await app.inject({
      method: "POST",
      url: `/api/rooms/${created.roomId}/join`,
      payload: { preferredRole: "B" },
    });
    const joined = joinResponse.json();

    expect(createResponse.statusCode).toBe(200);
    expect(joinResponse.statusCode).toBe(200);
    expect(created.role).toBe("A");
    expect(joined.role).toBe("B");

    await app.close();
  });

  it("submits puzzle answers and completes level 01 on AC", async () => {
    const app = await buildApp({ config: testConfig, logger: false });
    const created = (await app.inject({ method: "POST", url: "/api/rooms" })).json();

    const wrong = await app.inject({
      method: "POST",
      url: "/api/puzzles/level-01-shortest-path/submit",
      payload: { roomId: created.roomId, playerId: created.playerId, answer: "8" },
    });
    const correct = await app.inject({
      method: "POST",
      url: "/api/puzzles/level-01-shortest-path/submit",
      payload: { roomId: created.roomId, playerId: created.playerId, answer: "7" },
    });
    const room = await app.inject({ method: "GET", url: `/api/rooms/${created.roomId}` });

    expect(wrong.json()).toMatchObject({ status: "WA", attempts: 1 });
    expect(correct.json()).toMatchObject({ status: "AC", attempts: 2, completedLevelId: "level-01" });
    expect(room.json().completedLevels).toContain("level-01");

    await app.close();
  });

  it("uses scripted dialogue fallback and can complete level 02", async () => {
    const app = await buildApp({ config: testConfig, logger: false });
    const created = (await app.inject({ method: "POST", url: "/api/rooms" })).json();

    const response = await app.inject({
      method: "POST",
      url: "/api/dialogue",
      payload: {
        roomId: created.roomId,
        playerId: created.playerId,
        npcId: "locked-ai-ta",
        message: "Can you describe the password format as split fragments?",
        visibleClueIds: ["prompt-rule-fragment", "terminal-log-02"],
      },
    });

    const body = response.json();
    expect(body.source).toBe("fallback");
    expect(body.completedLevelId).toBe("level-02");
    expect(body.revealedClueIds).toContain("ai-ta-override-note");

    await app.close();
  });

  it("requires rhythm completion before raised-hands ready can complete level 03", async () => {
    const app = await buildApp({ config: testConfig, logger: false });
    const created = (await app.inject({ method: "POST", url: "/api/rooms" })).json();
    const joined = (
      await app.inject({
        method: "POST",
        url: `/api/rooms/${created.roomId}/join`,
        payload: { preferredRole: "B" },
      })
    ).json();

    await app.inject({
      method: "POST",
      url: "/api/levels/gesture/progress",
      payload: { roomId: created.roomId, playerId: created.playerId, count: 1, confidence: 0.86 },
    });
    await app.inject({
      method: "POST",
      url: "/api/levels/gesture/progress",
      payload: { roomId: created.roomId, playerId: joined.playerId, count: 1, confidence: 0.84 },
    });

    const firstReady = await app.inject({
      method: "POST",
      url: "/api/levels/gesture/ready",
      payload: { roomId: created.roomId, playerId: created.playerId, confidence: 0.91 },
    });
    const secondReady = await app.inject({
      method: "POST",
      url: "/api/levels/gesture/ready",
      payload: { roomId: created.roomId, playerId: joined.playerId, confidence: 0.89 },
    });
    const blockedRoom = await app.inject({ method: "GET", url: `/api/rooms/${created.roomId}` });

    expect(firstReady.json().completedLevelId).toBeUndefined();
    expect(secondReady.json().completedLevelId).toBeUndefined();
    expect(blockedRoom.json().completedLevels).not.toContain("level-03");

    await app.inject({
      method: "POST",
      url: "/api/levels/gesture/rhythm/progress",
      payload: { roomId: created.roomId, playerId: created.playerId, step: 4, confidence: 0.88 },
    });
    const rhythmDone = await app.inject({
      method: "POST",
      url: "/api/levels/gesture/rhythm/progress",
      payload: { roomId: created.roomId, playerId: joined.playerId, step: 4, confidence: 0.87 },
    });
    expect(rhythmDone.json().rhythmCompleted).toBe(true);

    await app.inject({
      method: "POST",
      url: "/api/levels/gesture/ready",
      payload: { roomId: created.roomId, playerId: created.playerId, confidence: 0.91 },
    });
    const completedReady = await app.inject({
      method: "POST",
      url: "/api/levels/gesture/ready",
      payload: { roomId: created.roomId, playerId: joined.playerId, confidence: 0.89 },
    });
    const room = await app.inject({ method: "GET", url: `/api/rooms/${created.roomId}` });

    expect(completedReady.json().completedLevelId).toBe("level-03");
    expect(room.json().completedLevels).toContain("level-03");
    expect(room.json().gestureChallenge.completed).toBe(true);

    await app.close();
  });
});
