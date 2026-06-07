"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.priceHistory = exports.redemptions = exports.trades = exports.markets = exports.blockTracker = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
exports.blockTracker = (0, pg_core_1.pgTable)("block_tracker", {
    id: (0, pg_core_1.integer)("id").primaryKey(),
    lastIndexedBlock: (0, pg_core_1.integer)("last_indexed_block").notNull().default(0),
    lastIndexedHash: (0, pg_core_1.text)("last_indexed_hash").notNull().default(""),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").notNull().defaultNow(),
});
exports.markets = (0, pg_core_1.pgTable)("markets", {
    id: (0, pg_core_1.text)("id").primaryKey(),
    address: (0, pg_core_1.text)("address").notNull(),
    question: (0, pg_core_1.text)("question").notNull(),
    category: (0, pg_core_1.text)("category"),
    externalId: (0, pg_core_1.text)("external_id"),
    endTime: (0, pg_core_1.timestamp)("end_time").notNull(),
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull(),
    createdTxHash: (0, pg_core_1.text)("created_tx_hash").notNull(),
    yesShares: (0, pg_core_1.numeric)("yes_shares", { precision: 78, scale: 0 }).notNull().default("0"),
    noShares: (0, pg_core_1.numeric)("no_shares", { precision: 78, scale: 0 }).notNull().default("0"),
    yesPrice: (0, pg_core_1.numeric)("yes_price", { precision: 78, scale: 0 }).default("500000000000000000"),
    noPrice: (0, pg_core_1.numeric)("no_price", { precision: 78, scale: 0 }).default("500000000000000000"),
    totalVolume: (0, pg_core_1.numeric)("total_volume", { precision: 78, scale: 0 }).notNull().default("0"),
    totalCollateral: (0, pg_core_1.numeric)("total_collateral", { precision: 78, scale: 0 }).notNull().default("0"),
    resolved: (0, pg_core_1.boolean)("resolved").notNull().default(false),
    winningOutcome: (0, pg_core_1.integer)("winning_outcome"),
    resolvedAt: (0, pg_core_1.timestamp)("resolved_at"),
    resolvedTxHash: (0, pg_core_1.text)("resolved_tx_hash"),
}, (t) => ({
    addressIdx: (0, pg_core_1.uniqueIndex)("markets_address_idx").on(t.address),
    endTimeIdx: (0, pg_core_1.index)("markets_end_time_idx").on(t.endTime),
    resolvedIdx: (0, pg_core_1.index)("markets_resolved_idx").on(t.resolved),
    categoryIdx: (0, pg_core_1.index)("markets_category_idx").on(t.category),
    externalIdIdx: (0, pg_core_1.index)("markets_external_id_idx").on(t.externalId),
}));
exports.trades = (0, pg_core_1.pgTable)("trades", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    marketId: (0, pg_core_1.text)("market_id").notNull().references(() => exports.markets.id),
    marketAddress: (0, pg_core_1.text)("market_address").notNull(),
    trader: (0, pg_core_1.text)("trader").notNull(),
    outcome: (0, pg_core_1.integer)("outcome").notNull(),
    type: (0, pg_core_1.text)("type").notNull(),
    sharesAmount: (0, pg_core_1.numeric)("shares_amount", { precision: 78, scale: 0 }).notNull(),
    collateralAmount: (0, pg_core_1.numeric)("collateral_amount", { precision: 78, scale: 0 }).notNull(),
    txHash: (0, pg_core_1.text)("tx_hash").notNull(),
    blockNumber: (0, pg_core_1.integer)("block_number").notNull(),
    logIndex: (0, pg_core_1.integer)("log_index").notNull(),
    timestamp: (0, pg_core_1.timestamp)("timestamp").notNull(),
}, (t) => ({
    uniqueTrade: (0, pg_core_1.uniqueIndex)("trades_tx_log_idx").on(t.txHash, t.logIndex),
    marketIdIdx: (0, pg_core_1.index)("trades_market_id_idx").on(t.marketId),
    traderIdx: (0, pg_core_1.index)("trades_trader_idx").on(t.trader),
    timestampIdx: (0, pg_core_1.index)("trades_timestamp_idx").on(t.timestamp),
    outcomeIdx: (0, pg_core_1.index)("trades_outcome_idx").on(t.marketId, t.outcome),
}));
exports.redemptions = (0, pg_core_1.pgTable)("redemptions", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    marketId: (0, pg_core_1.text)("market_id").notNull().references(() => exports.markets.id),
    marketAddress: (0, pg_core_1.text)("market_address").notNull(),
    trader: (0, pg_core_1.text)("trader").notNull(),
    collateralAmount: (0, pg_core_1.numeric)("collateral_amount", { precision: 78, scale: 0 }).notNull(),
    txHash: (0, pg_core_1.text)("tx_hash").notNull(),
    blockNumber: (0, pg_core_1.integer)("block_number").notNull(),
    timestamp: (0, pg_core_1.timestamp)("timestamp").notNull(),
}, (t) => ({
    uniqueRedemption: (0, pg_core_1.uniqueIndex)("redemptions_tx_idx").on(t.txHash),
    marketIdIdx: (0, pg_core_1.index)("redemptions_market_id_idx").on(t.marketId),
    traderIdx: (0, pg_core_1.index)("redemptions_trader_idx").on(t.trader),
}));
exports.priceHistory = (0, pg_core_1.pgTable)("price_history", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    marketId: (0, pg_core_1.text)("market_id").notNull().references(() => exports.markets.id),
    yesPrice: (0, pg_core_1.numeric)("yes_price", { precision: 78, scale: 0 }).notNull(),
    noPrice: (0, pg_core_1.numeric)("no_price", { precision: 78, scale: 0 }).notNull(),
    yesShares: (0, pg_core_1.numeric)("yes_shares", { precision: 78, scale: 0 }).notNull(),
    noShares: (0, pg_core_1.numeric)("no_shares", { precision: 78, scale: 0 }).notNull(),
    blockNumber: (0, pg_core_1.integer)("block_number").notNull(),
    timestamp: (0, pg_core_1.timestamp)("timestamp").notNull(),
}, (t) => ({
    marketTimeIdx: (0, pg_core_1.index)("price_history_market_time_idx").on(t.marketId, t.timestamp),
}));
