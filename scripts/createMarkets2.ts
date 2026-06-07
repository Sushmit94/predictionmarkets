/**
 * createMarkets2.ts
 * ─────────────────────────────────────────────────────────────
 * Creates a single market expiring in 20 minutes.
 * Writes to pending-markets.json so resolveMarkets.ts can resolve it.
 *
 * Run with:
 *   npx ts-node --compiler-options '{"module":"commonjs"}' scripts/createMarkets2.ts
 */

import { createWalletClient, createPublicClient, http } from "viem";
import { celo } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import * as fs from "fs";
import * as dotenv from "dotenv";

dotenv.config({ path: "./contracts/.env" });

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
] as const;

// ─── FETCH LIVE ETH PRICE ─────────────────────────────────────────────────────
async function fetchEthPrice(): Promise<number> {
  console.log("📊 Fetching live ETH price from CoinGecko...");
  const res = await fetch(
    "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd"
  );
  if (!res.ok) throw new Error(`CoinGecko error: ${res.status}`);
  const data = await res.json() as { ethereum: { usd: number } };
  console.log(`   ETH = $${data.ethereum.usd}`);
  return data.ethereum.usd;
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
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

  console.log(`🔑 Wallet: ${account.address}`);

  // ── Check balance ──────────────────────────────────────────────────────────
  const balance      = await publicClient.getBalance({ address: account.address });
  const balanceCelo  = Number(balance) / 1e18;
  console.log(`💰 Balance: ${balanceCelo.toFixed(6)} CELO`);

  if (balanceCelo < 0.05) {
    console.error(`\n❌ Not enough CELO. Need at least 0.05 CELO for gas.`);
    process.exit(1);
  }

  // ── Fetch price and build market ───────────────────────────────────────────
  const ethPrice    = await fetchEthPrice();
  const threshold   = parseFloat((ethPrice * 1.01).toFixed(2)); // 1% above current

  const EXPIRY_SECONDS = 20 * 60; // 20 minutes
  const now            = Math.floor(Date.now() / 1000);
  const endTime        = now + EXPIRY_SECONDS;
  const tag            = Date.now();
  const externalId     = `custom-eth-20m-${tag}`;

  const market = {
    question:   `Will ETH price be above $${threshold} in 20 minutes?`,
    category:   "crypto",
    externalId,
    endTime:    BigInt(endTime),
    liquidityParam: 0n,
  };

  console.log(`\n📝 Market: "${market.question}"`);
  console.log(`   ExternalId: ${externalId}`);
  console.log(`   Threshold:  $${threshold} (1% above current $${ethPrice})`);
  console.log(`   Expires at: ${new Date(endTime * 1000).toLocaleTimeString()} (20 min from now)`);

  // ── Estimate gas ───────────────────────────────────────────────────────────
  let gasEstimate: bigint;
  try {
    gasEstimate = await publicClient.estimateContractGas({
      address:      FACTORY_ADDRESS,
      abi:          FACTORY_ABI,
      functionName: "createMarket",
      args: [
        market.question,
        market.category,
        market.externalId,
        market.endTime,
        market.liquidityParam,
      ],
      account: account.address,
    });
    console.log(`\n⛽ Estimated gas: ${gasEstimate.toLocaleString()} units`);
  } catch (err) {
    console.error(`\n❌ Gas estimation failed — contract may have reverted.`);
    console.error(err);
    process.exit(1);
  }

  const gasPrice     = await publicClient.getGasPrice();
  const estimatedCost = Number(gasEstimate * gasPrice) / 1e18;
  console.log(`💸 Estimated cost: ${estimatedCost.toFixed(6)} CELO`);

  // ── Send transaction ───────────────────────────────────────────────────────
  console.log(`\n🚀 Sending transaction...`);

  const hash = await walletClient.writeContract({
    address:      FACTORY_ADDRESS,
    abi:          FACTORY_ABI,
    functionName: "createMarket",
    args: [
      market.question,
      market.category,
      market.externalId,
      market.endTime,
      market.liquidityParam,
    ],
    gas:      gasEstimate + gasEstimate / 10n, // +10% buffer
    gasPrice,
  });

  console.log(`✅ TX sent: https://celoscan.io/tx/${hash}`);
  console.log(`⏳ Waiting for confirmation...`);

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log(`\n🎉 Market created!`);
  console.log(`   Block:    ${receipt.blockNumber}`);
  console.log(`   Gas used: ${receipt.gasUsed.toLocaleString()}`);

  // Extract market proxy address from last log
  const log = receipt.logs[receipt.logs.length - 1];
  if (log) {
    console.log(`\n📌 Market proxy address: ${log.address}`);
    console.log(`   View: https://celoscan.io/address/${log.address}`);
  }

  // ── Write to pending-markets.json ─────────────────────────────────────────
  const configPath = "./scripts/pending-markets.json";

  // Load existing entries if file already exists, so we don't wipe old markets
  let existing: object[] = [];
  if (fs.existsSync(configPath)) {
    existing = JSON.parse(fs.readFileSync(configPath, "utf-8"));
  }

  const newEntry = {
    externalId,
    question:  market.question,
    endTime,
    coin:      "ethereum",
    direction: "above",
    threshold,
  };

  existing.push(newEntry);
  fs.writeFileSync(configPath, JSON.stringify(existing, null, 2));

  console.log(`\n💾 Written to pending-markets.json:`);
  console.log(JSON.stringify(newEntry, null, 2));

  console.log(`\n📋 Next steps:`);
  console.log(`   1. Wait until ${new Date(endTime * 1000).toLocaleTimeString()}`);
  console.log(`   2. Run: npx ts-node --compiler-options '{"module":"commonjs"}' scripts/resolveMarkets.ts`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});