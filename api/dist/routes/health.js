"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerHealthRoutes = registerHealthRoutes;
const client_1 = require("../db/client");
async function registerHealthRoutes(app) {
    app.get("/health", async () => {
        await client_1.pool.query("SELECT 1");
        return {
            ok: true,
            service: "celomarket-api",
            timestamp: new Date().toISOString(),
        };
    });
}
