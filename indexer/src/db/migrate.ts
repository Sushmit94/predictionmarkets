import "dotenv/config";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const SQL = `
-- Markets
CREATE TABLE IF NOT EXISTS markets (
  id                TEXT PRIMARY KEY,
  address           TEXT NOT NULL,
  question          TEXT NOT NULL,
  category          TEXT,
  external_id       TEXT,
  end_time          TIMESTAMPTZ NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL,
  created_tx_hash   TEXT NOT NULL,
  yes_shares        NUMERIC(78,0) DEFAULT 0,
  no_shares         NUMERIC(78,0) DEFAULT 0,
  yes_price         NUMERIC(30,18) DEFAULT 0,
  no_price          NUMERIC(30,18) DEFAULT 0,
  total_volume      NUMERIC(78,0) DEFAULT 0,
  total_collateral  NUMERIC(78,0) DEFAULT 0,
  resolved          BOOLEAN DEFAULT false,
  winning_outcome   INTEGER,
  resolved_at       TIMESTAMPTZ,
  resolved_tx_hash  TEXT
);

-- Trades
CREATE TABLE IF NOT EXISTS trades (
  id                SERIAL PRIMARY KEY,
  market_id         TEXT NOT NULL REFERENCES markets(id),
  market_address    TEXT NOT NULL,
  trader            TEXT NOT NULL,
  outcome           INTEGER NOT NULL,
  type              TEXT NOT NULL,
  shares_amount     NUMERIC(78,0) NOT NULL,
  collateral_amount NUMERIC(78,0) NOT NULL,
  tx_hash           TEXT NOT NULL UNIQUE,
  block_number      INTEGER NOT NULL,
  log_index         INTEGER NOT NULL,
  timestamp         TIMESTAMPTZ NOT NULL
);

-- Redemptions
CREATE TABLE IF NOT EXISTS redemptions (
  id                SERIAL PRIMARY KEY,
  market_id         TEXT NOT NULL REFERENCES markets(id),
  market_address    TEXT NOT NULL,
  trader            TEXT NOT NULL,
  collateral_amount NUMERIC(78,0) NOT NULL,
  tx_hash           TEXT NOT NULL UNIQUE,
  block_number      INTEGER NOT NULL,
  timestamp         TIMESTAMPTZ NOT NULL
);

-- Block tracker (single-row)
CREATE TABLE IF NOT EXISTS block_tracker (
  id                   INTEGER PRIMARY KEY DEFAULT 1,
  last_indexed_block   INTEGER NOT NULL,
  last_indexed_hash    TEXT NOT NULL,
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_trades_market_id  ON trades(market_id);
CREATE INDEX IF NOT EXISTS idx_trades_trader      ON trades(trader);
CREATE INDEX IF NOT EXISTS idx_trades_block       ON trades(block_number);
CREATE INDEX IF NOT EXISTS idx_markets_address    ON markets(address);
CREATE INDEX IF NOT EXISTS idx_markets_resolved   ON markets(resolved);
`;

async function migrate() {
  console.log("Running migrations...");
  await pool.query(SQL);
  console.log("✅ Migrations complete");
  await pool.end();
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});