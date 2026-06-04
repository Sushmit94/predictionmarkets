import type { FastifyInstance } from "fastify";
import { pool } from "../db/client";

export async function registerHealthRoutes(app: FastifyInstance): Promise<void> {
  app.get("/health", async () => {
    await pool.query("SELECT 1");
    return {
      ok: true,
      service: "celomarket-api",
      timestamp: new Date().toISOString(),
    };
  });
}
