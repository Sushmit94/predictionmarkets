import Fastify from "fastify";
import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import { config } from "./config";
import { closeDb } from "./db/client";
import { registerHealthRoutes } from "./routes/health";
import { registerMarketRoutes } from "./routes/markets";
import { registerPositionRoutes } from "./routes/positions";
import { closeRedis } from "./lib/redis";
import { registerPriceWs } from "./ws/prices";

export async function buildServer() {
  const app = Fastify({
    logger: true,
  });

  await app.register(cors, {
    origin: config.corsOrigin === "*" ? true : config.corsOrigin.split(","),
  });
  await app.register(websocket);

  await registerHealthRoutes(app);
  await registerMarketRoutes(app);
  await registerPositionRoutes(app);
  await registerPriceWs(app);

  app.setNotFoundHandler((_request, reply) => {
    reply.code(404).send({ error: "Route not found" });
  });

  app.setErrorHandler((error, _request, reply) => {
    app.log.error(error);
    reply.code(error.statusCode ?? 500).send({
      error: error.statusCode ? error.message : "Internal server error",
    });
  });

  app.addHook("onClose", async () => {
    await Promise.all([closeDb(), closeRedis()]);
  });

  return app;
}

async function main(): Promise<void> {
  const app = await buildServer();
  await app.listen({ port: config.port, host: config.host });
}

if (require.main === module) {
  main().catch((err) => {
    console.error("Fatal API error:", err);
    process.exit(1);
  });
}
