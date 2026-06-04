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

export const blockTracker = pgTable("block_tracker", {
  id: integer("id").primaryKey(),
  lastIndexedBlock: integer("last_indexed_block").notNull().default(0),
  lastIndexedHash: text("last_indexed_hash").notNull().default(""),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const markets = pgTable(
  "markets",
  {
    id: text("id").primaryKey(),
    address: text("address").notNull(),
    question: text("question").notNull(),
    category: text("category"),
    externalId: text("external_id"),
    endTime: timestamp("end_time").notNull(),
    createdAt: timestamp("created_at").notNull(),
    createdTxHash: text("created_tx_hash").notNull(),
    yesShares: numeric("yes_shares", { precision: 78, scale: 0 }).notNull().default("0"),
    noShares: numeric("no_shares", { precision: 78, scale: 0 }).notNull().default("0"),
    yesPrice: numeric("yes_price", { precision: 78, scale: 0 }).default("500000000000000000"),
    noPrice: numeric("no_price", { precision: 78, scale: 0 }).default("500000000000000000"),
    totalVolume: numeric("total_volume", { precision: 78, scale: 0 }).notNull().default("0"),
    totalCollateral: numeric("total_collateral", { precision: 78, scale: 0 }).notNull().default("0"),
    resolved: boolean("resolved").notNull().default(false),
    winningOutcome: integer("winning_outcome"),
    resolvedAt: timestamp("resolved_at"),
    resolvedTxHash: text("resolved_tx_hash"),
  },
  (t) => ({
    addressIdx: uniqueIndex("markets_address_idx").on(t.address),
    endTimeIdx: index("markets_end_time_idx").on(t.endTime),
    resolvedIdx: index("markets_resolved_idx").on(t.resolved),
    categoryIdx: index("markets_category_idx").on(t.category),
    externalIdIdx: index("markets_external_id_idx").on(t.externalId),
  })
);

export const trades = pgTable(
  "trades",
  {
    id: serial("id").primaryKey(),
    marketId: text("market_id").notNull().references(() => markets.id),
    marketAddress: text("market_address").notNull(),
    trader: text("trader").notNull(),
    outcome: integer("outcome").notNull(),
    type: text("type").notNull(),
    sharesAmount: numeric("shares_amount", { precision: 78, scale: 0 }).notNull(),
    collateralAmount: numeric("collateral_amount", { precision: 78, scale: 0 }).notNull(),
    txHash: text("tx_hash").notNull(),
    blockNumber: integer("block_number").notNull(),
    logIndex: integer("log_index").notNull(),
    timestamp: timestamp("timestamp").notNull(),
  },
  (t) => ({
    uniqueTrade: uniqueIndex("trades_tx_log_idx").on(t.txHash, t.logIndex),
    marketIdIdx: index("trades_market_id_idx").on(t.marketId),
    traderIdx: index("trades_trader_idx").on(t.trader),
    timestampIdx: index("trades_timestamp_idx").on(t.timestamp),
    outcomeIdx: index("trades_outcome_idx").on(t.marketId, t.outcome),
  })
);

export const redemptions = pgTable(
  "redemptions",
  {
    id: serial("id").primaryKey(),
    marketId: text("market_id").notNull().references(() => markets.id),
    marketAddress: text("market_address").notNull(),
    trader: text("trader").notNull(),
    collateralAmount: numeric("collateral_amount", { precision: 78, scale: 0 }).notNull(),
    txHash: text("tx_hash").notNull(),
    blockNumber: integer("block_number").notNull(),
    timestamp: timestamp("timestamp").notNull(),
  },
  (t) => ({
    uniqueRedemption: uniqueIndex("redemptions_tx_idx").on(t.txHash),
    marketIdIdx: index("redemptions_market_id_idx").on(t.marketId),
    traderIdx: index("redemptions_trader_idx").on(t.trader),
  })
);

export const priceHistory = pgTable(
  "price_history",
  {
    id: serial("id").primaryKey(),
    marketId: text("market_id").notNull().references(() => markets.id),
    yesPrice: numeric("yes_price", { precision: 78, scale: 0 }).notNull(),
    noPrice: numeric("no_price", { precision: 78, scale: 0 }).notNull(),
    yesShares: numeric("yes_shares", { precision: 78, scale: 0 }).notNull(),
    noShares: numeric("no_shares", { precision: 78, scale: 0 }).notNull(),
    blockNumber: integer("block_number").notNull(),
    timestamp: timestamp("timestamp").notNull(),
  },
  (t) => ({
    marketTimeIdx: index("price_history_market_time_idx").on(t.marketId, t.timestamp),
  })
);

export type Market = typeof markets.$inferSelect;
export type Trade = typeof trades.$inferSelect;
export type Redemption = typeof redemptions.$inferSelect;
export type PricePoint = typeof priceHistory.$inferSelect;
