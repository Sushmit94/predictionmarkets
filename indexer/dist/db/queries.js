"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAllMarketAddresses = getAllMarketAddresses;
exports.getMarketByAddress = getMarketByAddress;
exports.getMarketById = getMarketById;
exports.insertPriceSnapshot = insertPriceSnapshot;
exports.getRecentPrices = getRecentPrices;
exports.getRecentTrades = getRecentTrades;
exports.getTradesByTrader = getTradesByTrader;
exports.getTraderPosition = getTraderPosition;
exports.getTradesAfterBlock = getTradesAfterBlock;
/**
 * db/queries.ts
 *
 * Reusable typed query helpers consumed by processors and the main indexer loop.
 * Keeping queries here avoids duplicating filter logic across processor files.
 */
const drizzle_orm_1 = require("drizzle-orm");
const client_1 = require("./client");
const schema_1 = require("./schema");
// ─── Markets ──────────────────────────────────────────────────────────────────
/**
 * Returns all known market proxy addresses.
 * Called by the main indexer loop to build the getLogs address filter.
 */
async function getAllMarketAddresses() {
    const rows = await client_1.db
        .select({ address: schema_1.markets.address })
        .from(schema_1.markets);
    return rows.map((r) => r.address);
}
/**
 * Fetch a market row by its proxy contract address (lowercase).
 * Used by every trade/resolution processor.
 */
async function getMarketByAddress(address) {
    const rows = await client_1.db
        .select()
        .from(schema_1.markets)
        .where((0, drizzle_orm_1.eq)(schema_1.markets.address, address.toLowerCase()))
        .limit(1);
    return rows[0] ?? null;
}
/**
 * Fetch a market row by its numeric ID string.
 */
async function getMarketById(id) {
    const rows = await client_1.db
        .select()
        .from(schema_1.markets)
        .where((0, drizzle_orm_1.eq)(schema_1.markets.id, id))
        .limit(1);
    return rows[0] ?? null;
}
// ─── Price history ────────────────────────────────────────────────────────────
/**
 * Inserts a price snapshot after every trade.
 * Called by the sharesBought/sharesSold processors after updating markets row.
 */
async function insertPriceSnapshot(point) {
    await client_1.db
        .insert(schema_1.priceHistory)
        .values(point)
        .onConflictDoNothing();
}
/**
 * Returns the last N price points for a market (for chart rendering).
 * API layer calls this; kept here so the query is tested in one place.
 */
async function getRecentPrices(marketId, limit = 200) {
    return client_1.db
        .select()
        .from(schema_1.priceHistory)
        .where((0, drizzle_orm_1.eq)(schema_1.priceHistory.marketId, marketId))
        .orderBy((0, drizzle_orm_1.desc)(schema_1.priceHistory.timestamp))
        .limit(limit);
}
// ─── Trades ───────────────────────────────────────────────────────────────────
/**
 * Recent trades for a market — used by the API orderbook/history endpoints.
 */
async function getRecentTrades(marketId, limit = 50) {
    return client_1.db
        .select()
        .from(schema_1.trades)
        .where((0, drizzle_orm_1.eq)(schema_1.trades.marketId, marketId))
        .orderBy((0, drizzle_orm_1.desc)(schema_1.trades.timestamp))
        .limit(limit);
}
/**
 * All trades by a wallet address across all markets — portfolio page.
 */
async function getTradesByTrader(trader) {
    return client_1.db
        .select()
        .from(schema_1.trades)
        .where((0, drizzle_orm_1.eq)(schema_1.trades.trader, trader.toLowerCase()))
        .orderBy((0, drizzle_orm_1.desc)(schema_1.trades.timestamp));
}
/**
 * Net position for a trader in a specific market.
 * Returns { yesShares: bigint, noShares: bigint } after summing buys and sells.
 *
 * Note: this is a cross-check helper — the source of truth for balances is the
 * ConditionalTokens ERC-1155 contract. Use this for display estimates only.
 */
async function getTraderPosition(marketId, trader) {
    const rows = await client_1.db
        .select({
        outcome: schema_1.trades.outcome,
        type: schema_1.trades.type,
        sharesAmount: schema_1.trades.sharesAmount,
    })
        .from(schema_1.trades)
        .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.trades.marketId, marketId), (0, drizzle_orm_1.eq)(schema_1.trades.trader, trader.toLowerCase())));
    let yesShares = 0n;
    let noShares = 0n;
    for (const row of rows) {
        const amt = BigInt(row.sharesAmount);
        if (row.outcome === 1 /* YES */) {
            yesShares += row.type === "buy" ? amt : -amt;
        }
        else {
            noShares += row.type === "buy" ? amt : -amt;
        }
    }
    return { yesShares, noShares };
}
/**
 * Trades above a certain block number — used after reorg rollback to confirm
 * which rows were deleted and will be re-indexed.
 */
async function getTradesAfterBlock(blockNumber) {
    return client_1.db
        .select()
        .from(schema_1.trades)
        .where((0, drizzle_orm_1.gt)(schema_1.trades.blockNumber, blockNumber));
}
