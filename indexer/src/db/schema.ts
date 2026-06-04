import {
  pgTable,
  text,
  numeric,
  boolean,
  integer,
  serial,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// ─────────────────────────────────────────────────────────────────────────────
// block_tracker
// Single-row table (id = 1). Tracks the last successfully indexed block so the
// indexer can resume from the right place after a restart, and so detectReorg()
// can compare stored hash vs on-chain hash.
// ─────────────────────────────────────────────────────────────────────────────
export const blockTracker = pgTable("block_tracker", {
  id:               integer("id").primaryKey(),        // always 1
  lastIndexedBlock: integer("last_indexed_block").notNull().default(0),
  lastIndexedHash:  text("last_indexed_hash").notNull().default(""),
  updatedAt:        timestamp("updated_at").notNull().defaultNow(),
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
export const markets = pgTable(
  "markets",
  {
    // Numeric string — comes from MarketFactory.marketCount (uint256)
    id:      text("id").primaryKey(),

    // Lowercase proxy clone address — used to correlate PredictionMarket events
    address: text("address").notNull(),

    question:   text("question").notNull(),
    category:   text("category"),                // nullable — "crypto", "politics", …
    externalId: text("external_id"),             // Polymarket mirror ID or empty

    endTime:   timestamp("end_time").notNull(),
    createdAt: timestamp("created_at").notNull(),
    createdTxHash: text("created_tx_hash").notNull(),

    // ── LMSR share quantities (WAD strings, 18 decimals) ──────────────────
    // Seeded to liquidityParam at market creation (qYes = qNo = b).
    // Updated on every SharesBought / SharesSold event.
    yesShares: numeric("yes_shares", { precision: 78, scale: 0 })
      .notNull()
      .default("0"),
    noShares:  numeric("no_shares",  { precision: 78, scale: 0 })
      .notNull()
      .default("0"),

    // ── LMSR prices (WAD strings, 1e18 = 100%) ────────────────────────────
    // Recomputed by the indexer after every trade; cached here for fast API reads.
    // Initial value: 0.5 WAD = "500000000000000000"
    yesPrice: numeric("yes_price", { precision: 78, scale: 0 })
      .default("500000000000000000"),
    noPrice:  numeric("no_price",  { precision: 78, scale: 0 })
      .default("500000000000000000"),

    // ── Volume / collateral (WAD strings) ─────────────────────────────────
    // totalVolume    — cumulative G$ traded (buys + sells)
    // totalCollateral — G$ currently locked in the contract
    totalVolume:     numeric("total_volume",     { precision: 78, scale: 0 })
      .notNull()
      .default("0"),
    totalCollateral: numeric("total_collateral", { precision: 78, scale: 0 })
      .notNull()
      .default("0"),

    // ── Resolution ────────────────────────────────────────────────────────
    resolved:        boolean("resolved").notNull().default(false),
    winningOutcome:  integer("winning_outcome"),    // 0=NO, 1=YES, null until resolved
    resolvedAt:      timestamp("resolved_at"),
    resolvedTxHash:  text("resolved_tx_hash"),
  },
  (t) => ({
    // Fast lookup by contract address (used in every trade processor)
    addressIdx: uniqueIndex("markets_address_idx").on(t.address),
    // Sorted list queries: active markets, upcoming expiry
    endTimeIdx:   index("markets_end_time_idx").on(t.endTime),
    resolvedIdx:  index("markets_resolved_idx").on(t.resolved),
    categoryIdx:  index("markets_category_idx").on(t.category),
    externalIdIdx: index("markets_external_id_idx").on(t.externalId),
  })
);

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
export const trades = pgTable(
  "trades",
  {
    id: serial("id").primaryKey(),

    // Foreign key to markets.id (string)
    marketId:      text("market_id")
      .notNull()
      .references(() => markets.id),
    // Redundant but avoids a join in hot read paths
    marketAddress: text("market_address").notNull(),

    trader:  text("trader").notNull(),   // lowercase wallet address
    outcome: integer("outcome").notNull(), // 0=NO, 1=YES

    // "buy" | "sell" — derived from which event was emitted
    type: text("type").notNull(),

    // WAD strings (uint256 from contract)
    sharesAmount:     numeric("shares_amount",     { precision: 78, scale: 0 }).notNull(),
    collateralAmount: numeric("collateral_amount", { precision: 78, scale: 0 }).notNull(),

    txHash:      text("tx_hash").notNull(),
    blockNumber: integer("block_number").notNull(),
    logIndex:    integer("log_index").notNull(),   // position in block — part of unique key
    timestamp:   timestamp("timestamp").notNull(),
  },
  (t) => ({
    // Idempotency: a given (tx, log) can only appear once
    uniqueTrade: uniqueIndex("trades_tx_log_idx").on(t.txHash, t.logIndex),

    // Per-market trade history (API: GET /markets/:id/trades)
    marketIdIdx:  index("trades_market_id_idx").on(t.marketId),
    // Per-trader portfolio (API: GET /positions/:address)
    traderIdx:    index("trades_trader_idx").on(t.trader),
    // Chronological sort
    timestampIdx: index("trades_timestamp_idx").on(t.timestamp),
    // Outcome breakdown per market
    outcomeIdx:   index("trades_outcome_idx").on(t.marketId, t.outcome),
  })
);

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
export const redemptions = pgTable(
  "redemptions",
  {
    id: serial("id").primaryKey(),

    marketId:      text("market_id")
      .notNull()
      .references(() => markets.id),
    marketAddress: text("market_address").notNull(),

    trader:           text("trader").notNull(),
    collateralAmount: numeric("collateral_amount", { precision: 78, scale: 0 }).notNull(),

    txHash:      text("tx_hash").notNull(),
    blockNumber: integer("block_number").notNull(),
    timestamp:   timestamp("timestamp").notNull(),
  },
  (t) => ({
    // One redemption per trader per market (contract enforces burning all shares)
    uniqueRedemption: uniqueIndex("redemptions_tx_idx").on(t.txHash),

    marketIdIdx: index("redemptions_market_id_idx").on(t.marketId),
    traderIdx:   index("redemptions_trader_idx").on(t.trader),
  })
);

// ─────────────────────────────────────────────────────────────────────────────
// price_history
// Time-series snapshot written after every trade.
// Keeps the chart data for the frontend PriceChart component.
// Not sourced from a contract event — written by the indexer after processing
// each SharesBought / SharesSold log.
// ─────────────────────────────────────────────────────────────────────────────
export const priceHistory = pgTable(
  "price_history",
  {
    id: serial("id").primaryKey(),

    marketId: text("market_id")
      .notNull()
      .references(() => markets.id),

    // WAD strings — snapshot of LMSR prices after the triggering trade
    yesPrice: numeric("yes_price", { precision: 78, scale: 0 }).notNull(),
    noPrice:  numeric("no_price",  { precision: 78, scale: 0 }).notNull(),

    // Snapshot of shares at this point — lets the API recompute prices if needed
    yesShares: numeric("yes_shares", { precision: 78, scale: 0 }).notNull(),
    noShares:  numeric("no_shares",  { precision: 78, scale: 0 }).notNull(),

    blockNumber: integer("block_number").notNull(),
    timestamp:   timestamp("timestamp").notNull(),
  },
  (t) => ({
    // Primary chart query: all price points for a market, ordered by time
    marketTimeIdx: index("price_history_market_time_idx").on(t.marketId, t.timestamp),
  })
);

// ─────────────────────────────────────────────────────────────────────────────
// TypeScript type exports — used in processors and API route handlers
// ─────────────────────────────────────────────────────────────────────────────
export type Market      = typeof markets.$inferSelect;
export type NewMarket   = typeof markets.$inferInsert;
export type Trade       = typeof trades.$inferSelect;
export type NewTrade    = typeof trades.$inferInsert;
export type Redemption  = typeof redemptions.$inferSelect;
export type NewRedemption = typeof redemptions.$inferInsert;
export type PricePoint  = typeof priceHistory.$inferSelect;
export type NewPricePoint = typeof priceHistory.$inferInsert;