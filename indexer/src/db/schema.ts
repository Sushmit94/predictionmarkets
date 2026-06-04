import {
  pgTable,
  text,
  integer,
  boolean,
  numeric,
  timestamp,
  serial,
} from "drizzle-orm/pg-core";

// ─── Markets ──────────────────────────────────────────────────────────────────
// One row per market deployed by MarketFactory
export const markets = pgTable("markets", {
  id: text("id").primaryKey(),                // marketId from contract (uint256 as string)
  address: text("address").notNull(),         // proxy clone address
  question: text("question").notNull(),
  category: text("category"),
  externalId: text("external_id"),            // Polymarket ID if mirrored, else null

  endTime: timestamp("end_time").notNull(),
  createdAt: timestamp("created_at").notNull(),
  createdTxHash: text("created_tx_hash").notNull(),

  // Live share quantities — updated on every buy/sell
  yesShares: numeric("yes_shares", { precision: 78, scale: 0 }).default("0"),
  noShares: numeric("no_shares",  { precision: 78, scale: 0 }).default("0"),

  // Latest LMSR prices (0–1 range, stored as 18-decimal WAD strings)
  yesPrice: numeric("yes_price", { precision: 30, scale: 18 }).default("0"),
  noPrice:  numeric("no_price",  { precision: 30, scale: 18 }).default("0"),

  totalVolume: numeric("total_volume", { precision: 78, scale: 0 }).default("0"),
  totalCollateral: numeric("total_collateral", { precision: 78, scale: 0 }).default("0"),

  resolved: boolean("resolved").default(false),
  winningOutcome: integer("winning_outcome"),           // 0=NO, 1=YES, null if unresolved
  resolvedAt: timestamp("resolved_at"),
  resolvedTxHash: text("resolved_tx_hash"),
});

// ─── Trades ───────────────────────────────────────────────────────────────────
// One row per SharesBought / SharesSold event
export const trades = pgTable("trades", {
  id: serial("id").primaryKey(),
  marketId: text("market_id")
    .notNull()
    .references(() => markets.id),
  marketAddress: text("market_address").notNull(),

  trader: text("trader").notNull(),
  outcome: integer("outcome").notNull(),              // 0=NO, 1=YES
  type: text("type").notNull(),                       // 'buy' | 'sell'

  sharesAmount: numeric("shares_amount", { precision: 78, scale: 0 }).notNull(),
  collateralAmount: numeric("collateral_amount", { precision: 78, scale: 0 }).notNull(),

  txHash: text("tx_hash").notNull().unique(),
  blockNumber: integer("block_number").notNull(),
  logIndex: integer("log_index").notNull(),
  timestamp: timestamp("timestamp").notNull(),
});

// ─── Redemptions ─────────────────────────────────────────────────────────────
// One row per Redeemed event
export const redemptions = pgTable("redemptions", {
  id: serial("id").primaryKey(),
  marketId: text("market_id")
    .notNull()
    .references(() => markets.id),
  marketAddress: text("market_address").notNull(),

  trader: text("trader").notNull(),
  collateralAmount: numeric("collateral_amount", { precision: 78, scale: 0 }).notNull(),

  txHash: text("tx_hash").notNull().unique(),
  blockNumber: integer("block_number").notNull(),
  timestamp: timestamp("timestamp").notNull(),
});

// ─── Block tracker ────────────────────────────────────────────────────────────
// Stores the last indexed block + its hash (for reorg detection)
export const blockTracker = pgTable("block_tracker", {
  id: integer("id").primaryKey().default(1),   // single-row table
  lastIndexedBlock: integer("last_indexed_block").notNull(),
  lastIndexedHash: text("last_indexed_hash").notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});