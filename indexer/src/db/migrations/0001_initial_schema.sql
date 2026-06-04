-- ============================================================
-- 0001_initial_schema.sql
-- Run via: npm run migrate
-- ============================================================

-- ── block_tracker ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS block_tracker (
  id                  INTEGER PRIMARY KEY,        -- always 1
  last_indexed_block  INTEGER NOT NULL DEFAULT 0,
  last_indexed_hash   TEXT    NOT NULL DEFAULT '',
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── markets ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS markets (
  id                TEXT PRIMARY KEY,              -- uint256 string from contract
  address           TEXT NOT NULL,                 -- lowercase proxy clone address
  question          TEXT NOT NULL,
  category          TEXT,
  external_id       TEXT,                          -- Polymarket mirror ID

  end_time          TIMESTAMPTZ NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL,
  created_tx_hash   TEXT NOT NULL,

  -- LMSR share quantities (WAD, 18 decimals, stored as numeric strings)
  yes_shares        NUMERIC(78, 0) NOT NULL DEFAULT 0,
  no_shares         NUMERIC(78, 0) NOT NULL DEFAULT 0,

  -- LMSR prices cached post-trade (1e18 = 100%)
  yes_price         NUMERIC(78, 0) DEFAULT 500000000000000000,
  no_price          NUMERIC(78, 0) DEFAULT 500000000000000000,

  -- Volume / collateral
  total_volume      NUMERIC(78, 0) NOT NULL DEFAULT 0,
  total_collateral  NUMERIC(78, 0) NOT NULL DEFAULT 0,

  -- Resolution
  resolved          BOOLEAN NOT NULL DEFAULT FALSE,
  winning_outcome   INTEGER,          -- 0=NO, 1=YES, NULL until resolved
  resolved_at       TIMESTAMPTZ,
  resolved_tx_hash  TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS markets_address_idx    ON markets (address);
CREATE        INDEX IF NOT EXISTS markets_end_time_idx   ON markets (end_time);
CREATE        INDEX IF NOT EXISTS markets_resolved_idx   ON markets (resolved);
CREATE        INDEX IF NOT EXISTS markets_category_idx   ON markets (category);
CREATE        INDEX IF NOT EXISTS markets_external_id_idx ON markets (external_id);

-- ── trades ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS trades (
  id                SERIAL PRIMARY KEY,
  market_id         TEXT    NOT NULL REFERENCES markets (id),
  market_address    TEXT    NOT NULL,
  trader            TEXT    NOT NULL,
  outcome           INTEGER NOT NULL,   -- 0=NO, 1=YES
  type              TEXT    NOT NULL,   -- 'buy' | 'sell'
  shares_amount     NUMERIC(78, 0) NOT NULL,
  collateral_amount NUMERIC(78, 0) NOT NULL,
  tx_hash           TEXT    NOT NULL,
  block_number      INTEGER NOT NULL,
  log_index         INTEGER NOT NULL,
  timestamp         TIMESTAMPTZ NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS trades_tx_log_idx    ON trades (tx_hash, log_index);
CREATE        INDEX IF NOT EXISTS trades_market_id_idx ON trades (market_id);
CREATE        INDEX IF NOT EXISTS trades_trader_idx    ON trades (trader);
CREATE        INDEX IF NOT EXISTS trades_timestamp_idx ON trades (timestamp);
CREATE        INDEX IF NOT EXISTS trades_outcome_idx   ON trades (market_id, outcome);

-- ── redemptions ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS redemptions (
  id                SERIAL PRIMARY KEY,
  market_id         TEXT    NOT NULL REFERENCES markets (id),
  market_address    TEXT    NOT NULL,
  trader            TEXT    NOT NULL,
  collateral_amount NUMERIC(78, 0) NOT NULL,
  tx_hash           TEXT    NOT NULL,
  block_number      INTEGER NOT NULL,
  timestamp         TIMESTAMPTZ NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS redemptions_tx_idx        ON redemptions (tx_hash);
CREATE        INDEX IF NOT EXISTS redemptions_market_id_idx ON redemptions (market_id);
CREATE        INDEX IF NOT EXISTS redemptions_trader_idx    ON redemptions (trader);

-- ── price_history ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS price_history (
  id           SERIAL PRIMARY KEY,
  market_id    TEXT    NOT NULL REFERENCES markets (id),
  yes_price    NUMERIC(78, 0) NOT NULL,
  no_price     NUMERIC(78, 0) NOT NULL,
  yes_shares   NUMERIC(78, 0) NOT NULL,
  no_shares    NUMERIC(78, 0) NOT NULL,
  block_number INTEGER NOT NULL,
  timestamp    TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS price_history_market_time_idx
  ON price_history (market_id, timestamp);