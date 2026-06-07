"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildServer = buildServer;
const fastify_1 = __importDefault(require("fastify"));
const cors_1 = __importDefault(require("@fastify/cors"));
const websocket_1 = __importDefault(require("@fastify/websocket"));
const config_1 = require("./config");
const client_1 = require("./db/client");
const health_1 = require("./routes/health");
const markets_1 = require("./routes/markets");
const positions_1 = require("./routes/positions");
const redis_1 = require("./lib/redis");
const prices_1 = require("./ws/prices");
async function buildServer() {
    const app = (0, fastify_1.default)({
        logger: true,
    });
    await app.register(cors_1.default, {
        origin: config_1.config.corsOrigin === "*" ? true : config_1.config.corsOrigin.split(","),
    });
    await app.register(websocket_1.default);
    await (0, health_1.registerHealthRoutes)(app);
    await (0, markets_1.registerMarketRoutes)(app);
    await (0, positions_1.registerPositionRoutes)(app);
    await (0, prices_1.registerPriceWs)(app);
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
        await Promise.all([(0, client_1.closeDb)(), (0, redis_1.closeRedis)()]);
    });
    return app;
}
async function main() {
    const app = await buildServer();
    await app.listen({ port: config_1.config.port, host: config_1.config.host });
}
if (require.main === module) {
    main().catch((err) => {
        console.error("Fatal API error:", err);
        process.exit(1);
    });
}
