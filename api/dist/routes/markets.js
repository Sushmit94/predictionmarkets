"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerMarketRoutes = registerMarketRoutes;
const queries_1 = require("../db/queries");
const redis_1 = require("../lib/redis");
const format_1 = require("../lib/format");
const MARKET_STATUSES = new Set(["active", "ended", "resolved", "all"]);
const MARKET_SORTS = new Set(["newest", "ending", "volume"]);
async function registerMarketRoutes(app) {
    app.get("/markets", async (request, reply) => {
        const limit = (0, format_1.parseLimit)(request.query.limit, 25, 100);
        const page = (0, format_1.parsePage)(request.query.page);
        const status = MARKET_STATUSES.has(request.query.status ?? "")
            ? request.query.status ?? "active"
            : "active";
        const sort = MARKET_SORTS.has(request.query.sort ?? "")
            ? request.query.sort ?? "newest"
            : "newest";
        const { rows, total } = await (0, queries_1.listMarkets)({
            limit,
            offset: (page - 1) * limit,
            category: request.query.category,
            status,
            sort,
        });
        return reply.send({
            data: rows.map(format_1.serializeMarket),
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
    });
    app.get("/markets/:id", async (request, reply) => {
        const market = await (0, queries_1.getMarketById)(request.params.id);
        if (!market) {
            return reply.code(404).send({ error: "Market not found" });
        }
        await (0, redis_1.setCachedMarket)(market);
        const recentTrades = await (0, queries_1.getRecentTrades)(request.params.id, 25);
        return reply.send({
            data: (0, format_1.serializeMarket)(market),
            recentTrades: recentTrades.map(format_1.serializeTrade),
        });
    });
    app.get("/markets/:id/prices", async (request, reply) => {
        const market = await (0, queries_1.getMarketById)(request.params.id);
        if (!market) {
            return reply.code(404).send({ error: "Market not found" });
        }
        const limit = (0, format_1.parseLimit)(request.query.limit, 200, 1000);
        const rows = await (0, queries_1.getPriceHistory)(request.params.id, limit);
        return reply.send({
            data: rows.map(format_1.serializePricePoint),
            market: (0, format_1.serializeMarket)(market),
        });
    });
    app.get("/markets/:id/trades", async (request, reply) => {
        const market = await (0, queries_1.getMarketById)(request.params.id);
        if (!market) {
            return reply.code(404).send({ error: "Market not found" });
        }
        const limit = (0, format_1.parseLimit)(request.query.limit, 50, 250);
        const rows = await (0, queries_1.getRecentTrades)(request.params.id, limit);
        return reply.send({ data: rows.map(format_1.serializeTrade) });
    });
}
