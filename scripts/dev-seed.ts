/**
 * dev-seed.ts
 * ─────────────────────────────────────────────────────────────
 * Creates 4 GoodDollar-themed markets on-chain for dev/hackathon testing.
 * Each market expires in ~5 minutes so you can test resolution quickly.
 *
 * Markets use CoinGecko prices fetched at seed time as the baseline.
 * resolveMarkets.ts will check prices again at expiry and settle outcomes.
 *
 * Run with:
 *   cd ~/projects/celomarket
 *   npx ts-node --compiler-options '{"module":"commonjs"}' scripts/dev-seed.ts
 */

import { createWalletClient, createPublicClient, http } from "viem";
import { celo } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import * as dotenv from "dotenv";

dotenv.config({ path: "./contracts/.env" });

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

// ─── CoinGecko price fetch (no API key needed) ────────────────────────────────
interface CoinGeckoPrices {
  gooddollar: { usd: number };
  celo:       { usd: number };
  ethereum:   { usd: number };
}

async function fetchPrices(): Promise<CoinGeckoPrices> {
  console.log("📊 Fetching live prices from CoinGecko...");
  const url =
    "https://api.coingecko.com/api/v3/simple/price" +
    "?ids=gooddollar,celo,ethereum&vs_currencies=usd";

  const res = await fetch(url);
  if (!res.ok) throw new Error(`CoinGecko error: ${res.status}`);
  const data = await res.json() as CoinGeckoPrices;

  console.log(`   G$  = $${data.gooddollar.usd}`);
  console.log(`   CELO = $${data.celo.usd}`);
  console.log(`   ETH  = $${data.ethereum.usd}`);
  return data;
}

// ─── Build markets based on live prices ──────────────────────────────────────
function buildMarkets(prices: CoinGeckoPrices, expirySeconds: number) {
  const now        = Math.floor(Date.now() / 1000);
  const endTime    = now + expirySeconds;
  const tag        = Date.now(); // unique suffix so re-runs don't collide

  const gdPrice    = prices.gooddollar.usd;
  const celoPrice  = prices.celo.usd;
  const ethPrice   = prices.ethereum.usd;

  // Round to clean thresholds for readable questions
  const gdThreshold   = parseFloat((gdPrice * 1.02).toFixed(7));   // 2% above current
  const celoThreshold = parseFloat((celoPrice * 0.98).toFixed(4)); // 2% below current
  const ethThreshold  = parseFloat((ethPrice * 1.01).toFixed(2));  // 1% above current

  return [
    {
      // Market 1: Will G$ pump? (classic directional)
      question:   `Will GoodDollar (G$) price be above $${gdThreshold} in 5 minutes?`,
      category:   "GoodDollar",
      externalId: `dev-gd-pump-${tag}`,
      endTime:    BigInt(endTime),
      // Metadata for resolver — stored in externalId, parsed by resolveMarkets.ts
      resolution: {
        coin:      "gooddollar",
        direction: "above",
        threshold: gdThreshold,
      },
    },
    {
      // Market 2: Will CELO dip? (GoodDollar runs on Celo chain)
      question:   `Will CELO price drop below $${celoThreshold} in 5 minutes?`,
      category:   "GoodDollar",
      externalId: `dev-celo-dip-${tag}`,
      endTime:    BigInt(endTime),
      resolution: {
        coin:      "celo",
        direction: "below",
        threshold: celoThreshold,
      },
    },
    {
      // Market 3: Will G$ hold? (stability — near-coin UBI angle)
      question:   `Will GoodDollar (G$) price stay above $${parseFloat((gdPrice * 0.98).toFixed(7))} in 5 minutes?`,
      category:   "GoodDollar",
      externalId: `dev-gd-hold-${tag}`,
      endTime:    BigInt(endTime),
      resolution: {
        coin:      "gooddollar",
        direction: "above",
        threshold: parseFloat((gdPrice * 0.98).toFixed(7)),
      },
    },
    {
      // Market 4: ETH vs G$ — will ETH stay above threshold? (cross-chain context)
      question:   `Will ETH price be above $${ethThreshold} in 5 minutes?`,
      category:   "GoodDollar",
      externalId: `dev-eth-ref-${tag}`,
      endTime:    BigInt(endTime),
      resolution: {
        coin:      "ethereum",
        direction: "above",
        threshold: ethThreshold,
      },
    },
  ];
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const rawKey = process.env.PRIVATE_KEY;
  if (!rawKey) throw new Error("PRIVATE_KEY not found in contracts/.env");

  const privateKey = (rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`) as `0x${string}`;
  const account    = privateKeyToAccount(privateKey);
  console.log(`🔑 Wallet: ${account.address}`);

  const publicClient = createPublicClient({
    chain:     celo,
    transport: http("https://forno.celo.org"),
  });

  const walletClient = createWalletClient({
    account,
    chain:     celo,
    transport: http("https://forno.celo.org"),
  });

  // Fetch live prices
  const prices = await fetchPrices();

  // Build 4 markets expiring in 5 minutes
  const EXPIRY_SECONDS = 10 * 60; // change to 2 * 60 if you want 2 min for faster testing
  const markets = buildMarkets(prices, EXPIRY_SECONDS);

  console.log(`\n⏱  Markets will expire in ${EXPIRY_SECONDS / 60} minutes`);
  console.log(`🕐 Expiry time: ${new Date(Date.now() + EXPIRY_SECONDS * 1000).toLocaleTimeString()}\n`);

  // Write a resolution config file so resolveMarkets.ts knows what to check
  const resolutionConfig = markets.map((m) => ({
    externalId: m.externalId,
    question:   m.question,
    endTime:    Number(m.endTime),
    ...m.resolution,
  }));

  const fs = await import("fs");
  fs.writeFileSync(
    "./scripts/pending-markets.json",
    JSON.stringify(resolutionConfig, null, 2)
  );
  console.log(`💾 Saved resolution config to scripts/pending-markets.json`);
  console.log(`   (resolveMarkets.ts will read this to know what to resolve)\n`);

  // Create each market on-chain
  let created = 0;

  for (const market of markets) {
    console.log(`📝 Creating: ${market.question}`);
    console.log(`   ExternalId: ${market.externalId}`);

    try {
      const hash = await walletClient.writeContract({
        address:      FACTORY_ADDRESS,
        abi:          FACTORY_ABI,
        functionName: "createMarket",
        
        args: [
          market.question,
          market.category,
          market.externalId,
          market.endTime,
          0n,
        ],
      });

      console.log(`   ✅ TX: https://celoscan.io/tx/${hash}`);

      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      console.log(`   ⛓  Confirmed in block ${receipt.blockNumber}`);
      created++;

      await new Promise((r) => setTimeout(r, 1500));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`   ❌ Failed: ${msg}`);
    }
  }

  const expiryTime = new Date(Date.now() + EXPIRY_SECONDS * 1000);
  console.log(`\n🏁 Done. Created ${created}/4 markets.`);
  console.log(`\n📋 Next steps:`);
  console.log(`   1. Go to your frontend and place bets on these markets`);
  console.log(`   2. Wait until ${expiryTime.toLocaleTimeString()}`);
  console.log(`   3. Run: npx ts-node --compiler-options '{"module":"commonjs"}' scripts/resolveMarkets.ts`);
  console.log(`   4. Check your DB / frontend — winners should be paid out`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});