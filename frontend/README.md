# CeloMarket Frontend

Next.js App Router frontend for CeloMarket prediction markets.

## Getting Started

Create `.env.local` from `.env.example`, then run:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Routes

- `/` lists markets with status and sort filters.
- `/market/[id]` shows price history, trade preview, live price status, and recent trades.
- `/portfolio?address=0x...` shows wallet positions from the API.

## API

The app reads from:

- `NEXT_PUBLIC_API_URL`, default `http://localhost:4000`
- `NEXT_PUBLIC_WS_URL`, default derived from `NEXT_PUBLIC_API_URL`

When the API is unavailable, pages render demo data that matches the backend serializers.

## Checks

```bash
npm run lint
npm run build
```
