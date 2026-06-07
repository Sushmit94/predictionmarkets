import type { FastifyInstance } from "fastify";
import {
  getMarketById,
  getPriceHistory,
  getRecentTrades,
  listMarkets,
  type MarketSort,
  type MarketStatus,
} from "../db/queries";
import { setCachedMarket } from "../lib/redis";
import { parseLimit, parsePage, serializeMarket, serializePricePoint, serializeTrade } from "../lib/format";

interface MarketQuery {
  limit?: string;
  page?: string;
  category?: string;
  status?: MarketStatus;
  sort?: MarketSort;
}

interface LimitQuery {
  limit?: string;
}

const MARKET_STATUSES = new Set(["active", "ended", "resolved", "all"]);
const MARKET_SORTS = new Set(["newest", "ending", "volume"]);

export async function registerMarketRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Querystring: MarketQuery }>("/markets", async (request, reply) => {
    const limit = parseLimit(request.query.limit, 25, 100);
    const page = parsePage(request.query.page);
    const status = MARKET_STATUSES.has(request.query.status ?? "")
      ? request.query.status ?? "active"
      : "active";
    const sort = MARKET_SORTS.has(request.query.sort ?? "")
      ? request.query.sort ?? "newest"
      : "newest";

    const { rows, total } = await listMarkets({
      limit,
      offset: (page - 1) * limit,
      category: request.query.category,
      status,
      sort,
    });

    return reply.send({
      data: rows.map(serializeMarket),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  });

  app.get<{ Params: { id: string } }>("/markets/:id", async (request, reply) => {
    const market = await getMarketById(request.params.id);

    if (!market) {
      return reply.code(404).send({ error: "Market not found" });
    }

    await setCachedMarket(market);
    const recentTrades = await getRecentTrades(request.params.id, 25);

    return reply.send({
      data: serializeMarket(market),
      recentTrades: recentTrades.map(serializeTrade),
    });
  });

  app.get<{ Params: { id: string }; Querystring: LimitQuery }>(
    "/markets/:id/prices",
    async (request, reply) => {
      const market = await getMarketById(request.params.id);
      if (!market) {
        return reply.code(404).send({ error: "Market not found" });
      }

      const limit = parseLimit(request.query.limit, 200, 1000);
      const rows = await getPriceHistory(request.params.id, limit);

      return reply.send({
        data: rows.map(serializePricePoint),
        market: serializeMarket(market),
      });
    }
  );

  app.get<{ Params: { id: string }; Querystring: LimitQuery }>(
    "/markets/:id/trades",
    async (request, reply) => {
      const market = await getMarketById(request.params.id);
      if (!market) {
        return reply.code(404).send({ error: "Market not found" });
      }

      const limit = parseLimit(request.query.limit, 50, 250);
      const rows = await getRecentTrades(request.params.id, limit);
      return reply.send({ data: rows.map(serializeTrade) });
    }
  );
}
