import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db, pool } from "./client";
import { markets, priceHistory, trades } from "./schema";

export type MarketStatus = "active" | "resolved" | "all";
export type MarketSort = "newest" | "ending" | "volume";

export interface ListMarketsOptions {
  limit: number;
  offset: number;
  category?: string;
  status: MarketStatus;
  sort: MarketSort;
}

export interface PositionRow {
  marketId: string;
  marketAddress: string;
  question: string;
  category: string | null;
  resolved: boolean;
  winningOutcome: number | null;
  yesPrice: string;
  noPrice: string;
  yesShares: string;
  noShares: string;
  buyCollateral: string;
  sellCollateral: string;
  tradeCount: number;
  lastTradeAt: Date;
}

function marketWhere(options: ListMarketsOptions) {
  const filters = [];
  if (options.category) {
    filters.push(eq(markets.category, options.category));
  }
  if (options.status === "active") {
    filters.push(eq(markets.resolved, false));
  }
  if (options.status === "resolved") {
    filters.push(eq(markets.resolved, true));
  }
  return filters.length > 0 ? and(...filters) : undefined;
}

function marketOrderBy(sort: MarketSort) {
  if (sort === "ending") return asc(markets.endTime);
  if (sort === "volume") return desc(markets.totalVolume);
  return desc(markets.createdAt);
}

export async function listMarkets(options: ListMarketsOptions) {
  const where = marketWhere(options);

  const rows = await db
    .select()
    .from(markets)
    .where(where)
    .orderBy(marketOrderBy(options.sort))
    .limit(options.limit)
    .offset(options.offset);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(markets)
    .where(where);

  return { rows, total: count };
}

export async function getMarketById(id: string) {
  const rows = await db
    .select()
    .from(markets)
    .where(eq(markets.id, id))
    .limit(1);

  return rows[0] ?? null;
}

export async function getRecentTrades(marketId: string, limit: number) {
  return db
    .select()
    .from(trades)
    .where(eq(trades.marketId, marketId))
    .orderBy(desc(trades.timestamp))
    .limit(limit);
}

export async function getPriceHistory(marketId: string, limit: number) {
  const rows = await db
    .select()
    .from(priceHistory)
    .where(eq(priceHistory.marketId, marketId))
    .orderBy(desc(priceHistory.timestamp))
    .limit(limit);

  return rows.reverse();
}

export async function getPositionsByAddress(address: string): Promise<PositionRow[]> {
  const result = await pool.query(
    `
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
    `,
    [address.toLowerCase()]
  );

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
