/**
 * seedMarkets.ts
 * ─────────────────────────────────────────────────────────────
 * 1. Fetches active markets from Polymarket's public API
 * 2. Creates matching on-chain markets via your MarketFactory
 *
 * Place this file at:
 *   ~/projects/celomarket/scripts/seedMarkets.ts
 *
 * Run with:
 *   cd ~/projects/celomarket
 *   npx ts-node --compiler-options '{"module":"commonjs"}' scripts/seedMarkets.ts
 */

import { createWalletClient, createPublicClient, http, parseEther } from "viem";
import { celo } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import * as dotenv from "dotenv";

// ─── Load env from contracts/.env (where your private key lives) ─────────────
dotenv.config({ path: "./contracts/.env" });
// If your key is in api/.env instead, change to: dotenv.config({ path: "./api/.env" });

// ─── Config ───────────────────────────────────────────────────────────────────
const FACTORY_ADDRESS = "0xA35814251801859b5bD0f649c62cf7507DE852C7" as const;

const FACTORY_ABI = [
  {
    name: "createMarket",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "question",       type: "string"  },
      { name: "category",       type: "string"  },
      { name: "externalId",     type: "string"  },
      { name: "endTime",        type: "uint256" },
      { name: "liquidityParam", type: "uint256" },
    ],
    outputs: [
      { name: "marketId",      type: "uint256" },
      { name: "marketAddress", type: "address" },
    ],
  },
  {
    name: "externalIdToMarket",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "", type: "string" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

// ─── Polymarket API types ─────────────────────────────────────────────────────
interface PolymarketEvent {
  id:          string;
  title:       string;
  endDate:     string;       // ISO string
  markets:     PolymarketMarket[];
}

interface PolymarketMarket {
  id:          string;
  question:    string;
  endDate:     string;
  active:      boolean;
  closed:      boolean;
  category?:   string;
  groupItemTitle?: string;
}

// ─── Fetch active Polymarket questions ───────────────────────────────────────
async function fetchPolymarketQuestions(limit = 10): Promise<PolymarketMarket[]> {
  console.log("📡 Fetching markets from Polymarket...");

  // Gamma API — no auth needed, completely public
  const url =
    `https://gamma-api.polymarket.com/markets` +
    `?limit=${limit}&active=true&closed=false&order=volume&ascending=false`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Polymarket API error: ${res.status}`);

  const raw = await res.json() as PolymarketMarket[];

  // Filter: only markets with a real end date in the future
  const now = Date.now();
  const filtered = raw.filter((m) => {
    const end = new Date(m.endDate).getTime();
    return m.active && !m.closed && end > now + 24 * 60 * 60 * 1000; // at least 1 day away
  });

  console.log(`✅ Got ${filtered.length} active markets from Polymarket`);
  return filtered;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  // 1. Validate private key
  const rawKey = process.env.PRIVATE_KEY;
  if (!rawKey) {
    throw new Error(
      "PRIVATE_KEY not found in env.\n" +
      "Add it to contracts/.env as: PRIVATE_KEY=0xYOUR_KEY"
    );
  }
  const privateKey = (rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`) as `0x${string}`;
  const account    = privateKeyToAccount(privateKey);

  console.log(`🔑 Using wallet: ${account.address}`);

  // 2. Set up viem clients
  const publicClient = createPublicClient({
    chain:     celo,
    transport: http("https://forno.celo.org"),
  });

  const walletClient = createWalletClient({
    account,
    chain:     celo,
    transport: http("https://forno.celo.org"),
  });

  // 3. Fetch questions from Polymarket
  const questions = await fetchPolymarketQuestions(10); // fetch top 10 by volume

  // 4. Create each market on-chain (skip if already mirrored)
  let created = 0;
  let skipped = 0;

  for (const market of questions) {
    const externalId = market.id;

    // Check if already exists on-chain
    const existing = await publicClient.readContract({
      address:      FACTORY_ADDRESS,
      abi:          FACTORY_ABI,
      functionName: "externalIdToMarket",
      args:         [externalId],
    });

    if (existing !== 0n) {
      console.log(`⏭  Already exists (externalId: ${externalId}) — skipping`);
      skipped++;
      continue;
    }

    // Calculate endTime — use Polymarket's end date, capped at max 90 days
    const polyEnd   = new Date(market.endDate).getTime();
    const maxEnd    = Date.now() + 90 * 24 * 60 * 60 * 1000;
    const endTimeMs = Math.min(polyEnd, maxEnd);
    const endTime   = BigInt(Math.floor(endTimeMs / 1000));

    // Map category
    const category = market.category ?? "General";

    console.log(`\n📝 Creating market:`);
    console.log(`   Question:   ${market.question}`);
    console.log(`   Category:   ${category}`);
    console.log(`   ExternalId: ${externalId}`);
    console.log(`   End time:   ${new Date(endTimeMs).toISOString()}`);

    try {
      const hash = await walletClient.writeContract({
        address:      FACTORY_ADDRESS,
        abi:          FACTORY_ABI,
        functionName: "createMarket",
        args: [
          market.question,
          category,
          externalId,
          endTime,
          0n, // 0 = use defaultLiquidityParam from factory (1000e18)
        ],
      });

      console.log(`   ✅ TX sent: https://celoscan.io/tx/${hash}`);

      // Wait for confirmation before next market
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      console.log(`   ⛓  Confirmed in block ${receipt.blockNumber}`);
      created++;

      // Small delay to avoid nonce issues
      await new Promise((r) => setTimeout(r, 2000));

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`   ❌ Failed: ${msg}`);
      // Continue to next market even if one fails
    }
  }

  console.log(`\n🏁 Done. Created: ${created}  Skipped: ${skipped}`);
  console.log(`\nNext steps:`);
  console.log(`  1. Wait ~30s for your indexer to pick up the MarketCreated events`);
  console.log(`  2. Run: curl http://localhost:4000/markets`);
  console.log(`  3. You should see your real markets in the API response`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});