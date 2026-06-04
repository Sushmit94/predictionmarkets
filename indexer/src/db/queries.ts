/**
 * db/queries.ts
 *
 * Reusable typed query helpers consumed by processors and the main indexer loop.
 * Keeping queries here avoids duplicating filter logic across processor files.
 */
import { eq, desc, and, gt } from "drizzle-orm";
import { db }                  from "./client";
import { markets, trades, priceHistory } from "./schema";
import type { NewPricePoint }  from "./schema";

// ─── Markets ──────────────────────────────────────────────────────────────────

/**
 * Returns all known market proxy addresses.
 * Called by the main indexer loop to build the getLogs address filter.
 */
export async function getAllMarketAddresses(): Promise<string[]> {
  const rows = await db
    .select({ address: markets.address })
    .from(markets);
  return rows.map((r) => r.address);
}

/**
 * Fetch a market row by its proxy contract address (lowercase).
 * Used by every trade/resolution processor.
 */
export async function getMarketByAddress(address: string) {
  const rows = await db
    .select()
    .from(markets)
    .where(eq(markets.address, address.toLowerCase()))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Fetch a market row by its numeric ID string.
 */
export async function getMarketById(id: string) {
  const rows = await db
    .select()
    .from(markets)
    .where(eq(markets.id, id))
    .limit(1);
  return rows[0] ?? null;
}

// ─── Price history ────────────────────────────────────────────────────────────

/**
 * Inserts a price snapshot after every trade.
 * Called by the sharesBought/sharesSold processors after updating markets row.
 */
export async function insertPriceSnapshot(point: NewPricePoint): Promise<void> {
  await db
    .insert(priceHistory)
    .values(point)
    .onConflictDoNothing();
}

/**
 * Returns the last N price points for a market (for chart rendering).
 * API layer calls this; kept here so the query is tested in one place.
 */
export async function getRecentPrices(marketId: string, limit = 200) {
  return db
    .select()
    .from(priceHistory)
    .where(eq(priceHistory.marketId, marketId))
    .orderBy(desc(priceHistory.timestamp))
    .limit(limit);
}

// ─── Trades ───────────────────────────────────────────────────────────────────

/**
 * Recent trades for a market — used by the API orderbook/history endpoints.
 */
export async function getRecentTrades(marketId: string, limit = 50) {
  return db
    .select()
    .from(trades)
    .where(eq(trades.marketId, marketId))
    .orderBy(desc(trades.timestamp))
    .limit(limit);
}

/**
 * All trades by a wallet address across all markets — portfolio page.
 */
export async function getTradesByTrader(trader: string) {
  return db
    .select()
    .from(trades)
    .where(eq(trades.trader, trader.toLowerCase()))
    .orderBy(desc(trades.timestamp));
}

/**
 * Net position for a trader in a specific market.
 * Returns { yesShares: bigint, noShares: bigint } after summing buys and sells.
 *
 * Note: this is a cross-check helper — the source of truth for balances is the
 * ConditionalTokens ERC-1155 contract. Use this for display estimates only.
 */
export async function getTraderPosition(
  marketId: string,
  trader: string
): Promise<{ yesShares: bigint; noShares: bigint }> {
  const rows = await db
    .select({
      outcome:         trades.outcome,
      type:            trades.type,
      sharesAmount:    trades.sharesAmount,
    })
    .from(trades)
    .where(
      and(
        eq(trades.marketId, marketId),
        eq(trades.trader, trader.toLowerCase())
      )
    );

  let yesShares = 0n;
  let noShares  = 0n;

  for (const row of rows) {
    const amt = BigInt(row.sharesAmount);
    if (row.outcome === 1 /* YES */) {
      yesShares += row.type === "buy" ? amt : -amt;
    } else {
      noShares += row.type === "buy" ? amt : -amt;
    }
  }

  return { yesShares, noShares };
}

/**
 * Trades above a certain block number — used after reorg rollback to confirm
 * which rows were deleted and will be re-indexed.
 */
export async function getTradesAfterBlock(blockNumber: number) {
  return db
    .select()
    .from(trades)
    .where(gt(trades.blockNumber, blockNumber));
}