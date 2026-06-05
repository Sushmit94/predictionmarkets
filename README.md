# 🔮 CeloMarket — Decentralized Prediction Markets on Celo

> **Bet on real-world outcomes. Powered by GoodDollar. Priced by math.**
> A fully on-chain prediction market protocol built on Celo mainnet — with LMSR automated market making, sybil-resistant identity, and real-time price feeds.

---

## ✨ What is CeloMarket?

CeloMarket is an open, permissionless prediction market protocol — think **Polymarket, but on Celo**. Anyone with a verified GoodDollar identity can create markets, buy YES/NO shares on real-world events, and earn G$ when they're right.

**How it works in one line:**
> You pay G$ → get YES or NO shares → if you're right, you redeem G$ back at a profit.

Prices are set algorithmically by an LMSR (Logarithmic Market Scoring Rule) AMM — the same battle-tested pricing model used by Polymarket. No order books. No liquidity providers. Pure math.

---

## 🗺️ System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        CELO MAINNET                         │
│   MarketFactory ──deploys──▶ PredictionMarket (per market)  │
│         │                        │                          │
│         │                  ConditionalTokens                │
│         │               (YES / NO ERC-1155 shares)          │
│         │                        │                          │
│         └──── GoodDollar Identity (sybil gate) ─────────────┤
└─────────────────────────────────────────────────────────────┘
              │ events (getLogs)
              ▼
┌─────────────────────────┐
│   Node.js Indexer       │  ← polls Celo RPC every 2s
│   (custom, no TheGraph) │  → writes to Postgres
└─────────────────────────┘
              │
              ▼
┌─────────────────────────┐      ┌──────────────┐
│   Fastify REST API      │ ◀──▶ │    Redis      │
│   + WebSocket server    │      │  (price cache │
└─────────────────────────┘      │  + pub/sub)   │
              │                  └──────────────┘
              ▼
┌─────────────────────────┐
│   Next.js 14 Frontend   │  ← Wagmi v2, Viem, RainbowKit
│   (App Router)          │  ← Live prices via WebSocket
└─────────────────────────┘
```

---

## 🏗️ Architecture — Layer by Layer

### 1. Smart Contracts (Solidity 0.8.x · Celo Mainnet · chainId 42220)

| Contract | Role |
|---|---|
| `MarketFactory.sol` | Deploys new markets via minimal proxy (Clones). Maintains the `marketId → address` registry. |
| `PredictionMarket.sol` | Core LMSR AMM — handles share pricing, buying, selling, and resolution. |
| `ConditionalTokens.sol` | ERC-1155 tokens representing YES and NO shares per market. |
| `IGoodDollar.sol` | Interface to the G$ ERC-20 collateral token on Celo. |

**Pricing model — LMSR (Logarithmic Market Scoring Rule):**

The cost function `C(q) = b · ln(Σ exp(qᵢ/b))` determines share prices. As more people buy YES, YES price rises and NO price falls — always summing to 1 (100%). Prices reflect the crowd's collective probability estimate.

Fixed-point math is handled by **PRBMath** — audited, gas-efficient, EVM-compatible.

**Sybil resistance via GoodDollar Identity:**
Every `buy()` and `redeem()` call checks `identity.isWhitelisted(msg.sender)`. Unverified wallets cannot trade. One human, one set of positions.

**Gas efficiency:**
`MarketFactory` uses OpenZeppelin `Clones.clone()` (EIP-1167 minimal proxy) — deploying a new market costs a fraction of deploying a full contract.

---

### 2. Custom Indexer (Node.js + TypeScript)

> No TheGraph. No third-party indexing. You own your data.

The indexer is a long-running Node.js worker that polls the Celo RPC (`forno.celo.org`) every **2 seconds** (Celo block time is ~5s), fetches event logs in batches of 500 blocks, and writes structured data to Postgres.

**Events indexed:**

| Event | What it does |
|---|---|
| `MarketCreated` | Inserts a new market row with question, endTime, address |
| `SharesBought` | Records trade, updates `yesShares`/`noShares`, recalculates price |
| `SharesSold` | Same as above, inverse direction |
| `MarketResolved` | Marks market resolved, stores winning outcome |

**Reorg protection:**
The indexer stores both `blockNumber` and `blockHash`. On every poll it verifies the stored hash still matches the canonical chain. If a reorg is detected, it rolls back to the last confirmed safe block and re-processes.

**After each processed log:**
→ Postgres row is updated  
→ Redis pub/sub publishes to `market:price:<marketId>`  
→ WebSocket server broadcasts to all subscribed frontend clients

---

### 3. Backend API (Fastify · PostgreSQL · Redis)

**REST Endpoints:**

| Method | Route | Returns |
|---|---|---|
| `GET` | `/markets` | Paginated list of all markets with current prices |
| `GET` | `/markets/:id` | Full market detail — question, prices, volume, resolution status |
| `GET` | `/markets/:id/prices` | Price history for charting |
| `GET` | `/positions/:address` | All open positions for a wallet |

**WebSocket (`/ws/prices`):**
Clients subscribe to specific market IDs. The server listens to Redis pub/sub and pushes price updates the moment a new trade is indexed. Latency from on-chain trade → UI update is typically **under 10 seconds**.

**Redis caching:**
Market prices (computed from on-chain LMSR formula) are cached with a **5-second TTL**. Cache is invalidated immediately on trade events — so you never serve stale prices when markets are active.

---

### 4. Frontend (Next.js 14 · Wagmi v2 · Viem · RainbowKit · TailwindCSS)

**Key pages:**

| Route | What it shows |
|---|---|
| `/` | All active markets — YES price, volume, end time |
| `/market/[id]` | Market detail — price chart, trade panel, recent trades |
| `/portfolio` | Connected wallet's positions and P&L |

**Trade flow (step by step):**
1. User connects wallet via RainbowKit (Celo chain pre-configured)
2. `IdentityGate` checks GoodDollar whitelist — prompts verification if needed
3. User picks YES or NO, enters amount
4. App checks G$ allowance — sends `approve()` if needed
5. App simulates `buy()` on-chain — shows expected shares + slippage
6. User confirms → `writeContract` → receipt
7. UI updates optimistically; WebSocket confirms with real data

**Client-side LMSR simulation (`lib/lmsr.ts`):**
The trade panel runs the LMSR cost function in the browser — so users see their expected price impact *before* submitting a transaction. No surprises.

---

## 🔄 Resolution Flow

For the current version, markets are resolved by an **admin oracle** (you, or a multi-sig) after the real-world event concludes.

```
Event concludes
     │
     ▼
Admin calls resolve(marketId, outcome)  ← onlyOracle modifier
     │
     ▼
Contract sets resolved = true, winningOutcome = 0 or 1
     │
     ▼
Winners call redeem()
     │
     ▼
Winning shares burned → G$ sent back at rate:
  payout = (yourShares / totalWinningShares) × totalCollateral
```

---

## 🗄️ Database Schema (Postgres · drizzle-orm)

**`markets` table** — one row per deployed market  
**`trades` table** — one row per on-chain buy/sell event  
**`blocks` table** — last indexed block + hash (reorg tracking)

---

## 🚀 Deployment

| Service | Platform |
|---|---|
| Smart Contracts | Foundry → Celo Mainnet |
| Indexer | Railway / Render (always-on worker) |
| REST API + WebSocket | Railway / Render (web service) |
| PostgreSQL | Railway managed Postgres / Supabase |
| Redis | Railway managed Redis / Upstash |
| Frontend | Vercel |





---

## 📦 Monorepo Structure

```
celomarket/
├── contracts/              # Solidity — Foundry project
│   ├── MarketFactory.sol
│   ├── PredictionMarket.sol
│   ├── ConditionalTokens.sol
│   └── interfaces/
│       └── IGoodDollar.sol
│
├── indexer/                # Node.js event indexer
│   └── src/
│       ├── index.ts
│       ├── blockTracker.ts
│       ├── eventFetcher.ts
│       └── processors/
│           ├── marketCreated.ts
│           ├── sharesBought.ts
│           ├── sharesSold.ts
│           └── marketResolved.ts
│
├── api/                    # Fastify REST + WebSocket API
│   └── src/
│       ├── server.ts
│       ├── routes/
│       ├── ws/
│       └── db/
│
└── frontend/               # Next.js 14 App Router
    ├── app/
    ├── components/
    ├── hooks/
    └── lib/
```

---

## 🔗 Key Dependencies

| Package | Purpose |
|---|---|
| `prb-math` | Fixed-point math for LMSR (audited) |
| `@openzeppelin/contracts` | ERC-1155, Clones, access control |
| `wagmi` + `viem` | Ethereum wallet + contract interaction |
| `rainbowkit` | Wallet connect UI (Celo built-in) |
| `drizzle-orm` | Type-safe Postgres ORM |
| `ioredis` | Redis client for caching + pub/sub |
| `fastify` | High-performance Node.js API server |
| `recharts` | Price history charts |

---

## 🌐 Useful Links

- [Celo Mainnet RPC](https://forno.celo.org) — free public endpoint
- [GoodDollar Identity SDK](https://docs.gooddollar.org/for-developers/apis-and-sdks/sybil-resistance)
- [G$ Token on Celo](https://celoscan.io/token/0x62B8B11039FcfE5aB0C56E502b1C372A3d2a9c7A)
- [PRBMath](https://github.com/PaulRBerg/prb-math) — fixed-point math library
- [OpenZeppelin Clones](https://docs.openzeppelin.com/contracts/4.x/api/proxy#Clones)

---

## 📄 License

MIT — build on it, fork it, ship it.

---

<p align="center">Built for the GoodDollar × Celo Buildathon · Prediction markets for the real world</p>
