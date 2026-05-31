import { once } from "node:events";
import { AddressInfo } from "node:net";
import { describe, expect, it } from "vitest";
import WebSocket from "ws";
import { buildApp } from "../app";
import { testConfig } from "./test-config";

describe("WebSocket room gateway", () => {
  it("broadcasts player position to the other player in the same room", async () => {
    const app = await buildApp({ config: testConfig, logger: false });
    await app.listen({ host: "127.0.0.1", port: 0 });
    const address = app.server.address() as AddressInfo;
    const baseUrl = `http://127.0.0.1:${address.port}`;

    const created = (await app.inject({ method: "POST", url: "/api/rooms" })).json();
    const joined = (
      await app.inject({
        method: "POST",
        url: `/api/rooms/${created.roomId}/join`,
        payload: { preferredRole: "B" },
      })
    ).json();

    const playerA = new WebSocket(`${baseUrl}/ws?roomId=${created.roomId}&playerId=${created.playerId}`);
    const playerB = new WebSocket(`${baseUrl}/ws?roomId=${created.roomId}&playerId=${joined.playerId}`);

    await Promise.all([once(playerA, "open"), once(playerB, "open")]);

    const received = new Promise<Record<string, unknown>>((resolve) => {
      playerB.on("message", (data) => {
        const event = JSON.parse(data.toString()) as Record<string, unknown>;
        if (event.type === "player:position") {
          resolve(event);
        }
      });
    });

    playerA.send(JSON.stringify({ type: "player:position", payload: { position: { x: 12, y: 34 } } }));

    await expect(received).resolves.toMatchObject({
      type: "player:position",
      payload: {
        playerId: created.playerId,
        position: { x: 12, y: 34 },
      },
    });

    playerA.close();
    playerB.close();
    await app.close();
  });
});
