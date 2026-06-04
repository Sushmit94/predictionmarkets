"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.priceHistory = exports.redemptions = exports.trades = exports.markets = exports.blockTracker = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
// ─────────────────────────────────────────────────────────────────────────────
// block_tracker
// Single-row table (id = 1). Tracks the last successfully indexed block so the
// indexer can resume from the right place after a restart, and so detectReorg()
// can compare stored hash vs on-chain hash.
// ─────────────────────────────────────────────────────────────────────────────
exports.blockTracker = (0, pg_core_1.pgTable)("block_tracker", {
    id: (0, pg_core_1.integer)("id").primaryKey(), // always 1
    lastIndexedBlock: (0, pg_core_1.integer)("last_indexed_block").notNull().default(0),
    lastIndexedHash: (0, pg_core_1.text)("last_indexed_hash").notNull().default(""),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").notNull().defaultNow(),
});
// ─────────────────────────────────────────────────────────────────────────────
// markets
// One row per MarketCreated event from MarketFactory.
//
// Sources:
//   - MarketCreated(marketId, marketAddress, question, category, externalId, endTime)
//   - SharesBought / SharesSold  → updates yesShares, noShares, yesPrice, noPrice,
//                                   totalVolume, totalCollateral
//   - MarketResolved(winningOutcome, timestamp) → sets resolved, winningOutcome,
//                                                  resolvedAt, resolvedTxHash
// ─────────────────────────────────────────────────────────────────────────────
exports.markets = (0, pg_core_1.pgTable)("markets", {
    // Numeric string — comes from MarketFactory.marketCount (uint256)
    id: (0, pg_core_1.text)("id").primaryKey(),
    // Lowercase proxy clone address — used to correlate PredictionMarket events
    address: (0, pg_core_1.text)("address").notNull(),
    question: (0, pg_core_1.text)("question").notNull(),
    category: (0, pg_core_1.text)("category"), // nullable — "crypto", "politics", …
    externalId: (0, pg_core_1.text)("external_id"), // Polymarket mirror ID or empty
    endTime: (0, pg_core_1.timestamp)("end_time").notNull(),
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull(),
    createdTxHash: (0, pg_core_1.text)("created_tx_hash").notNull(),
    // ── LMSR share quantities (WAD strings, 18 decimals) ──────────────────
    // Seeded to liquidityParam at market creation (qYes = qNo = b).
    // Updated on every SharesBought / SharesSold event.
    yesShares: (0, pg_core_1.numeric)("yes_shares", { precision: 78, scale: 0 })
        .notNull()
        .default("0"),
    noShares: (0, pg_core_1.numeric)("no_shares", { precision: 78, scale: 0 })
        .notNull()
        .default("0"),
    // ── LMSR prices (WAD strings, 1e18 = 100%) ────────────────────────────
    // Recomputed by the indexer after every trade; cached here for fast API reads.
    // Initial value: 0.5 WAD = "500000000000000000"
    yesPrice: (0, pg_core_1.numeric)("yes_price", { precision: 78, scale: 0 })
        .default("500000000000000000"),
    noPrice: (0, pg_core_1.numeric)("no_price", { precision: 78, scale: 0 })
        .default("500000000000000000"),
    // ── Volume / collateral (WAD strings) ─────────────────────────────────
    // totalVolume    — cumulative G$ traded (buys + sells)
    // totalCollateral — G$ currently locked in the contract
    totalVolume: (0, pg_core_1.numeric)("total_volume", { precision: 78, scale: 0 })
        .notNull()
        .default("0"),
    totalCollateral: (0, pg_core_1.numeric)("total_collateral", { precision: 78, scale: 0 })
        .notNull()
        .default("0"),
    // ── Resolution ────────────────────────────────────────────────────────
    resolved: (0, pg_core_1.boolean)("resolved").notNull().default(false),
    winningOutcome: (0, pg_core_1.integer)("winning_outcome"), // 0=NO, 1=YES, null until resolved
    resolvedAt: (0, pg_core_1.timestamp)("resolved_at"),
    resolvedTxHash: (0, pg_core_1.text)("resolved_tx_hash"),
}, (t) => ({
    // Fast lookup by contract address (used in every trade processor)
    addressIdx: (0, pg_core_1.uniqueIndex)("markets_address_idx").on(t.address),
    // Sorted list queries: active markets, upcoming expiry
    endTimeIdx: (0, pg_core_1.index)("markets_end_time_idx").on(t.endTime),
    resolvedIdx: (0, pg_core_1.index)("markets_resolved_idx").on(t.resolved),
    categoryIdx: (0, pg_core_1.index)("markets_category_idx").on(t.category),
    externalIdIdx: (0, pg_core_1.index)("markets_external_id_idx").on(t.externalId),
}));
// ─────────────────────────────────────────────────────────────────────────────
// trades
// One row per SharesBought or SharesSold event from any PredictionMarket clone.
//
// Sources:
//   SharesBought(trader, outcome, sharesAmount, collateralPaid)
//   SharesSold  (trader, outcome, sharesAmount, collateralReceived)
//
// Unique on (tx_hash, log_index) — makes upsert idempotent so the indexer can
// safely re-process a block range after a restart or reorg rollback.
// ─────────────────────────────────────────────────────────────────────────────
exports.trades = (0, pg_core_1.pgTable)("trades", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    // Foreign key to markets.id (string)
    marketId: (0, pg_core_1.text)("market_id")
        .notNull()
        .references(() => exports.markets.id),
    // Redundant but avoids a join in hot read paths
    marketAddress: (0, pg_core_1.text)("market_address").notNull(),
    trader: (0, pg_core_1.text)("trader").notNull(), // lowercase wallet address
    outcome: (0, pg_core_1.integer)("outcome").notNull(), // 0=NO, 1=YES
    // "buy" | "sell" — derived from which event was emitted
    type: (0, pg_core_1.text)("type").notNull(),
    // WAD strings (uint256 from contract)
    sharesAmount: (0, pg_core_1.numeric)("shares_amount", { precision: 78, scale: 0 }).notNull(),
    collateralAmount: (0, pg_core_1.numeric)("collateral_amount", { precision: 78, scale: 0 }).notNull(),
    txHash: (0, pg_core_1.text)("tx_hash").notNull(),
    blockNumber: (0, pg_core_1.integer)("block_number").notNull(),
    logIndex: (0, pg_core_1.integer)("log_index").notNull(), // position in block — part of unique key
    timestamp: (0, pg_core_1.timestamp)("timestamp").notNull(),
}, (t) => ({
    // Idempotency: a given (tx, log) can only appear once
    uniqueTrade: (0, pg_core_1.uniqueIndex)("trades_tx_log_idx").on(t.txHash, t.logIndex),
    // Per-market trade history (API: GET /markets/:id/trades)
    marketIdIdx: (0, pg_core_1.index)("trades_market_id_idx").on(t.marketId),
    // Per-trader portfolio (API: GET /positions/:address)
    traderIdx: (0, pg_core_1.index)("trades_trader_idx").on(t.trader),
    // Chronological sort
    timestampIdx: (0, pg_core_1.index)("trades_timestamp_idx").on(t.timestamp),
    // Outcome breakdown per market
    outcomeIdx: (0, pg_core_1.index)("trades_outcome_idx").on(t.marketId, t.outcome),
}));
// ─────────────────────────────────────────────────────────────────────────────
// redemptions
// One row per Redeemed event from any PredictionMarket clone.
//
// Source:
//   Redeemed(trader, collateralAmount)
//
// Separate from trades because redemptions happen post-resolution and carry
// different semantics (no shares involved, just G$ payout).
// ─────────────────────────────────────────────────────────────────────────────
exports.redemptions = (0, pg_core_1.pgTable)("redemptions", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    marketId: (0, pg_core_1.text)("market_id")
        .notNull()
        .references(() => exports.markets.id),
    marketAddress: (0, pg_core_1.text)("market_address").notNull(),
    trader: (0, pg_core_1.text)("trader").notNull(),
    collateralAmount: (0, pg_core_1.numeric)("collateral_amount", { precision: 78, scale: 0 }).notNull(),
    txHash: (0, pg_core_1.text)("tx_hash").notNull(),
    blockNumber: (0, pg_core_1.integer)("block_number").notNull(),
    timestamp: (0, pg_core_1.timestamp)("timestamp").notNull(),
}, (t) => ({
    // One redemption per trader per market (contract enforces burning all shares)
    uniqueRedemption: (0, pg_core_1.uniqueIndex)("redemptions_tx_idx").on(t.txHash),
    marketIdIdx: (0, pg_core_1.index)("redemptions_market_id_idx").on(t.marketId),
    traderIdx: (0, pg_core_1.index)("redemptions_trader_idx").on(t.trader),
}));
// ─────────────────────────────────────────────────────────────────────────────
// price_history
// Time-series snapshot written after every trade.
// Keeps the chart data for the frontend PriceChart component.
// Not sourced from a contract event — written by the indexer after processing
// each SharesBought / SharesSold log.
// ─────────────────────────────────────────────────────────────────────────────
exports.priceHistory = (0, pg_core_1.pgTable)("price_history", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    marketId: (0, pg_core_1.text)("market_id")
        .notNull()
        .references(() => exports.markets.id),
    // WAD strings — snapshot of LMSR prices after the triggering trade
    yesPrice: (0, pg_core_1.numeric)("yes_price", { precision: 78, scale: 0 }).notNull(),
    noPrice: (0, pg_core_1.numeric)("no_price", { precision: 78, scale: 0 }).notNull(),
    // Snapshot of shares at this point — lets the API recompute prices if needed
    yesShares: (0, pg_core_1.numeric)("yes_shares", { precision: 78, scale: 0 }).notNull(),
    noShares: (0, pg_core_1.numeric)("no_shares", { precision: 78, scale: 0 }).notNull(),
    blockNumber: (0, pg_core_1.integer)("block_number").notNull(),
    timestamp: (0, pg_core_1.timestamp)("timestamp").notNull(),
}, (t) => ({
    // Primary chart query: all price points for a market, ordered by time
    marketTimeIdx: (0, pg_core_1.index)("price_history_market_time_idx").on(t.marketId, t.timestamp),
}));
