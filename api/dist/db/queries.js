"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listMarkets = listMarkets;
exports.getMarketById = getMarketById;
exports.getRecentTrades = getRecentTrades;
exports.getPriceHistory = getPriceHistory;
exports.getPositionsByAddress = getPositionsByAddress;
const drizzle_orm_1 = require("drizzle-orm");
const client_1 = require("./client");
const schema_1 = require("./schema");
function marketWhere(options) {
    const filters = [];
    if (options.category) {
        filters.push((0, drizzle_orm_1.eq)(schema_1.markets.category, options.category));
    }
    if (options.status === "active") {
        filters.push((0, drizzle_orm_1.eq)(schema_1.markets.resolved, false));
        filters.push((0, drizzle_orm_1.gt)(schema_1.markets.endTime, new Date()));
    }
    if (options.status === "ended") {
        filters.push((0, drizzle_orm_1.eq)(schema_1.markets.resolved, false));
        filters.push((0, drizzle_orm_1.lte)(schema_1.markets.endTime, new Date()));
    }
    if (options.status === "resolved") {
        filters.push((0, drizzle_orm_1.eq)(schema_1.markets.resolved, true));
    }
    return filters.length > 0 ? (0, drizzle_orm_1.and)(...filters) : undefined;
}
function marketOrderBy(sort) {
    if (sort === "ending")
        return (0, drizzle_orm_1.asc)(schema_1.markets.endTime);
    if (sort === "volume")
        return (0, drizzle_orm_1.desc)(schema_1.markets.totalVolume);
    return (0, drizzle_orm_1.desc)(schema_1.markets.createdAt);
}
async function listMarkets(options) {
    const where = marketWhere(options);
    const rows = await client_1.db
        .select()
        .from(schema_1.markets)
        .where(where)
        .orderBy(marketOrderBy(options.sort))
        .limit(options.limit)
        .offset(options.offset);
    const [{ count }] = await client_1.db
        .select({ count: (0, drizzle_orm_1.sql) `count(*)::int` })
        .from(schema_1.markets)
        .where(where);
    return { rows, total: count };
}
async function getMarketById(id) {
    const rows = await client_1.db
        .select()
        .from(schema_1.markets)
        .where((0, drizzle_orm_1.eq)(schema_1.markets.id, id))
        .limit(1);
    return rows[0] ?? null;
}
async function getRecentTrades(marketId, limit) {
    return client_1.db
        .select()
        .from(schema_1.trades)
        .where((0, drizzle_orm_1.eq)(schema_1.trades.marketId, marketId))
        .orderBy((0, drizzle_orm_1.desc)(schema_1.trades.timestamp))
        .limit(limit);
}
async function getPriceHistory(marketId, limit) {
    const rows = await client_1.db
        .select()
        .from(schema_1.priceHistory)
        .where((0, drizzle_orm_1.eq)(schema_1.priceHistory.marketId, marketId))
        .orderBy((0, drizzle_orm_1.desc)(schema_1.priceHistory.timestamp))
        .limit(limit);
    return rows.reverse();
}
async function getPositionsByAddress(address) {
    const result = await client_1.pool.query(`
      SELECT
        t.market_id,
        m.address AS market_address,
        m.question,
        m.category,
        m.resolved,
        m.winning_outcome,
        COALESCE(m.yes_price, 0)::text AS yes_price,
        COALESCE(m.no_price, 0)::text AS no_price,
        COALESCE(SUM(
          CASE
            WHEN t.outcome = 1 AND t.type = 'buy' THEN t.shares_amount
            WHEN t.outcome = 1 AND t.type = 'sell' THEN -t.shares_amount
            ELSE 0
          END
        ), 0)::text AS yes_shares,
        COALESCE(SUM(
          CASE
            WHEN t.outcome = 0 AND t.type = 'buy' THEN t.shares_amount
            WHEN t.outcome = 0 AND t.type = 'sell' THEN -t.shares_amount
            ELSE 0
          END
        ), 0)::text AS no_shares,
        COALESCE(SUM(CASE WHEN t.type = 'buy' THEN t.collateral_amount ELSE 0 END), 0)::text AS buy_collateral,
        COALESCE(SUM(CASE WHEN t.type = 'sell' THEN t.collateral_amount ELSE 0 END), 0)::text AS sell_collateral,
        COUNT(*)::int AS trade_count,
        MAX(t.timestamp) AS last_trade_at
      FROM trades t
      INNER JOIN markets m ON m.id = t.market_id
      WHERE t.trader = $1
      GROUP BY
        t.market_id,
        m.address,
        m.question,
        m.category,
        m.resolved,
        m.winning_outcome,
        m.yes_price,
        m.no_price
      HAVING
        COALESCE(SUM(
          CASE
            WHEN t.outcome = 1 AND t.type = 'buy' THEN t.shares_amount
            WHEN t.outcome = 1 AND t.type = 'sell' THEN -t.shares_amount
            ELSE 0
          END
        ), 0) <> 0
        OR
        COALESCE(SUM(
          CASE
            WHEN t.outcome = 0 AND t.type = 'buy' THEN t.shares_amount
            WHEN t.outcome = 0 AND t.type = 'sell' THEN -t.shares_amount
            ELSE 0
          END
        ), 0) <> 0
      ORDER BY MAX(t.timestamp) DESC
    `, [address.toLowerCase()]);
    return result.rows.map((row) => ({
        marketId: row.market_id,
        marketAddress: row.market_address,
        question: row.question,
        category: row.category,
        resolved: row.resolved,
        winningOutcome: row.winning_outcome,
        yesPrice: row.yes_price,
        noPrice: row.no_price,
        yesShares: row.yes_shares,
        noShares: row.no_shares,
        buyCollateral: row.buy_collateral,
        sellCollateral: row.sell_collateral,
        tradeCount: row.trade_count,
        lastTradeAt: row.last_trade_at,
    }));
}
