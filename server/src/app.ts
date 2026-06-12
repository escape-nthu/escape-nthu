import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import Fastify, { type FastifyInstance } from "fastify";
import type { ServerConfig } from "./config";
import { ApiError } from "./errors";
import { NpcService } from "./ai/npc-service";
import { InMemoryRoomStore } from "./realtime/room-state";
import { RoomGateway } from "./realtime/websocket";
import { registerDialogueRoutes } from "./routes/dialogue";
import { registerHealthRoutes } from "./routes/health";
import { registerLevelRoutes } from "./routes/levels";
import { registerPuzzleRoutes } from "./routes/puzzles";
import { registerRoomRoutes } from "./routes/rooms";

export type AppOptions = {
  config: ServerConfig;
  logger?: boolean;
  store?: InMemoryRoomStore;
};

export async function buildApp(options: AppOptions): Promise<FastifyInstance> {
  const app = Fastify({ logger: options.logger ?? true });
  const store = options.store ?? new InMemoryRoomStore();
  const gateway = new RoomGateway(store);
  const npcService = new NpcService(options.config);

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ApiError) {
      return reply.status(error.statusCode).send({
        error: {
          code: error.code,
          message: error.message,
        },
      });
    }

    app.log.error(error);
    return reply.status(500).send({
      error: {
        code: "INTERNAL_ERROR",
        message: "Unexpected server error",
      },
    });
  });

  await app.register(cors, {
    origin: true,
  });
  await app.register(websocket);

  gateway.register(app);
  await registerHealthRoutes(app);
  await registerRoomRoutes(app, { store, gateway });
  await registerPuzzleRoutes(app, { store, gateway });
  await registerLevelRoutes(app, { store, gateway });
  await registerDialogueRoutes(app, { store, gateway, npcService });

  const cleanupInterval = setInterval(() => {
    store.cleanupRooms();
  }, 1000 * 60);

  app.addHook("onClose", (instance, done) => {
    clearInterval(cleanupInterval);
    done();
  });

  return app;
}
