/**
 * resolveMarkets.ts
 * ─────────────────────────────────────────────────────────────
 * 1. Reads scripts/pending-markets.json (written by dev-seed.ts)
 * 2. For each expired market, fetches current price from CoinGecko
 * 3. Determines YES or NO outcome
 * 4. Calls your smart contract's resolve function on-chain
 *
 * Run manually after markets expire:
 *   npx ts-node --compiler-options '{"module":"commonjs"}' scripts/resolveMarkets.ts
 *
 * Or run on a cron every 60s to auto-resolve:
 *   * * * * * cd ~/projects/celomarket && npx ts-node --compiler-options '{"module":"commonjs"}' scripts/resolveMarkets.ts >> logs/resolver.log 2>&1
 */

import { createWalletClient, createPublicClient, http } from "viem";
import { celo } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import * as fs from "fs";
import * as dotenv from "dotenv";

dotenv.config({ path: "./contracts/.env" });

// ─── Config ───────────────────────────────────────────────────────────────────

// ⚠️  Replace with your actual Market contract ABI resolve function
// This assumes your Market contract has: resolveMarket(bool outcome)
// Adjust the function name / args to match your actual contract
const MARKET_ABI = [
  {
    name: "resolveMarket",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "outcome", type: "bool" }, // true = YES wins, false = NO wins
    ],
    outputs: [],
  },
  {
    name: "resolved",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "endTime",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

// Your MarketFactory ABI — needed to look up market address from externalId
const FACTORY_ADDRESS = "0xA35814251801859b5bD0f649c62cf7507DE852C7" as const;

const FACTORY_ABI = [
  {
    name: "externalIdToMarket",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "", type: "string" }],
    outputs: [{ name: "", type: "uint256" }], // returns marketId
  },
  {
    name: "markets",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "marketId", type: "uint256" }],
    outputs: [
      { name: "marketAddress", type: "address" },
      { name: "question",      type: "string"  },
      { name: "resolved",      type: "bool"    },
    ],
  },
] as const;

// ─── Types ────────────────────────────────────────────────────────────────────
interface PendingMarket {
  externalId: string;
  question:   string;
  endTime:    number;       // unix seconds
  coin:       string;       // coingecko id e.g. "gooddollar"
  direction:  "above" | "below";
  threshold:  number;
}

// ─── Fetch prices for all unique coins in one call ────────────────────────────
async function fetchPrices(coinIds: string[]): Promise<Record<string, number>> {
  const ids = [...new Set(coinIds)].join(",");
  const url  = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`CoinGecko error: ${res.status}`);

  const data = await res.json() as Record<string, { usd: number }>;

  const prices: Record<string, number> = {};
  for (const [coin, val] of Object.entries(data)) {
    prices[coin] = val.usd;
  }
  return prices;
}

// ─── Determine outcome ────────────────────────────────────────────────────────
function determineOutcome(
  market: PendingMarket,
  currentPrice: number
): boolean {
  const { direction, threshold, coin } = market;

  const outcome =
    direction === "above"
      ? currentPrice > threshold
      : currentPrice < threshold;

  console.log(
    `   ${coin} current price: $${currentPrice} | ` +
    `threshold: $${threshold} | ` +
    `direction: ${direction} | ` +
    `outcome: ${outcome ? "✅ YES" : "❌ NO"}`
  );

  return outcome;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n🔍 resolveMarkets.ts — ${new Date().toLocaleTimeString()}`);

  // 1. Load pending markets
  const configPath = "./scripts/pending-markets.json";
  if (!fs.existsSync(configPath)) {
    console.log("⚠️  No pending-markets.json found. Run dev-seed.ts first.");
    return;
  }

  const allMarkets: PendingMarket[] = JSON.parse(
    fs.readFileSync(configPath, "utf-8")
  );

  const now = Math.floor(Date.now() / 1000);

  // 2. Filter to only expired markets
  const expired = allMarkets.filter((m) => m.endTime <= now);
  const pending  = allMarkets.filter((m) => m.endTime > now);

  if (expired.length === 0) {
    const nextExpiry = Math.min(...allMarkets.map((m) => m.endTime));
    const secsLeft   = nextExpiry - now;
    console.log(
      `⏳ No markets have expired yet. ` +
      `Next expiry in ${secsLeft}s (${new Date(nextExpiry * 1000).toLocaleTimeString()})`
    );
    return;
  }

  console.log(`📋 Found ${expired.length} expired market(s) to resolve\n`);

  // 3. Fetch prices for all coins needed
  const coinIds = expired.map((m) => m.coin);
  const prices  = await fetchPrices(coinIds);
  console.log("📊 Current prices:", prices);
  console.log();

  // 4. Set up viem clients
  const rawKey = process.env.PRIVATE_KEY;
  if (!rawKey) throw new Error("PRIVATE_KEY not found in contracts/.env");

  const privateKey = (rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`) as `0x${string}`;
  const account    = privateKeyToAccount(privateKey);

  const publicClient = createPublicClient({
    chain:     celo,
    transport: http("https://forno.celo.org"),
  });

  const walletClient = createWalletClient({
    account,
    chain:     celo,
    transport: http("https://forno.celo.org"),
  });

  const resolved: string[] = [];
  const failed:   string[] = [];

  // 5. Resolve each expired market on-chain
  for (const market of expired) {
    console.log(`\n🎯 Resolving: ${market.question}`);
    console.log(`   ExternalId: ${market.externalId}`);
    console.log(`   Expired at: ${new Date(market.endTime * 1000).toLocaleTimeString()}`);

    try {
      // Look up marketId from factory
      const marketId = await publicClient.readContract({
        address:      FACTORY_ADDRESS,
        abi:          FACTORY_ABI,
        functionName: "externalIdToMarket",
        args:         [market.externalId],
      });

      if (marketId === 0n) {
        console.log(`   ⚠️  Market not found on-chain (externalId not registered). Skipping.`);
        failed.push(market.externalId);
        continue;
      }

      // Get market address from factory
      const marketData = await publicClient.readContract({
        address:      FACTORY_ADDRESS,
        abi:          FACTORY_ABI,
        functionName: "markets",
        args:         [marketId],
      });

      const marketAddress = marketData[0] as `0x${string}`;
      const alreadyResolved = marketData[2] as boolean;

      if (alreadyResolved) {
        console.log(`   ℹ️  Already resolved on-chain. Skipping.`);
        resolved.push(market.externalId);
        continue;
      }

      console.log(`   📍 Market address: ${marketAddress}`);

      // Determine YES/NO outcome
      const currentPrice = prices[market.coin];
      if (currentPrice === undefined) {
        console.error(`   ❌ No price found for coin: ${market.coin}`);
        failed.push(market.externalId);
        continue;
      }

      const outcome = determineOutcome(market, currentPrice);

      // Call resolveMarket on the individual market contract
      const hash = await walletClient.writeContract({
        address:      marketAddress,
        abi:          MARKET_ABI,
        functionName: "resolveMarket",
        args:         [outcome],
      });

      console.log(`   ✅ Resolved ${outcome ? "YES" : "NO"} — TX: https://celoscan.io/tx/${hash}`);

      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      console.log(`   ⛓  Confirmed in block ${receipt.blockNumber}`);

      resolved.push(market.externalId);
      await new Promise((r) => setTimeout(r, 1500));

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`   ❌ Failed to resolve: ${msg}`);
      failed.push(market.externalId);
    }
  }

  // 6. Update pending-markets.json — remove resolved ones, keep still-pending
  const remaining = pending.concat(
    expired.filter((m) => failed.includes(m.externalId))
  );

  fs.writeFileSync(configPath, JSON.stringify(remaining, null, 2));

  // 7. Summary
  console.log(`\n─────────────────────────────────────────`);
  console.log(`🏁 Resolution run complete`);
  console.log(`   ✅ Resolved: ${resolved.length}`);
  console.log(`   ❌ Failed:   ${failed.length}`);
  console.log(`   ⏳ Remaining in queue: ${pending.length}`);

  if (resolved.length > 0) {
    console.log(`\n📋 Next steps:`);
    console.log(`   1. Check your frontend — winning positions should show payout`);
    console.log(`   2. Run: curl http://localhost:4000/markets to see resolved status`);
    console.log(`   3. Your indexer should have picked up the MarketResolved events`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});