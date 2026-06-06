/**
 * create-market.ts
 * Creates a single market on-chain. Run once per market.
 * Much cheaper than dev-seed.ts — explicit gas controls.
 *
 * Usage:
 *   npx ts-node --compiler-options '{"module":"commonjs"}' scripts/create-market.ts
 */

import { createWalletClient, createPublicClient, http, parseGwei } from "viem";
import { celo } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
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

// ─── EDIT THESE FOR EACH MARKET ───────────────────────────────────────────────
const MARKET = {
  question:       "Will CELO trade above $0.06 before July 31, 2026?",
  category:       "crypto",
  externalId:     "",   // leave empty for admin-created markets
  // 30 days from now
  endTime:        BigInt(Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60),
  liquidityParam: 0n,   // 0 = use factory default
};
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  const rawKey = process.env.PRIVATE_KEY;
  if (!rawKey) throw new Error("PRIVATE_KEY not found in contracts/.env");

  const privateKey = (
    rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`
  ) as `0x${string}`;

  const account = privateKeyToAccount(privateKey);

  const publicClient = createPublicClient({
    chain: celo,
    transport: http("https://forno.celo.org"),
  });

  const walletClient = createWalletClient({
    account,
    chain: celo,
    transport: http("https://forno.celo.org"),
  });

  // ── Check balance first ──────────────────────────────────────────────────
  const balance = await publicClient.getBalance({ address: account.address });
  const balanceCelo = Number(balance) / 1e18;
  console.log(`🔑 Wallet:  ${account.address}`);
  console.log(`💰 Balance: ${balanceCelo.toFixed(6)} CELO`);

  if (balanceCelo < 0.05) {
    console.error(`\n❌ Not enough CELO. You need at least 0.05 CELO for gas.`);
    console.error(`   Current balance: ${balanceCelo.toFixed(6)} CELO`);
    console.error(`   Get CELO by swapping G$ on https://app.uniswap.org (Celo network)`);
    process.exit(1);
  }

  // ── Estimate gas before sending ──────────────────────────────────────────
  console.log(`\n📝 Market: "${MARKET.question}"`);
  console.log(`   Category:  ${MARKET.category}`);
  console.log(`   ExternalId: "${MARKET.externalId || "(none)"}"`);
  console.log(
    `   End time:  ${new Date(Number(MARKET.endTime) * 1000).toLocaleDateString()}`
  );

  let gasEstimate: bigint;
  try {
    gasEstimate = await publicClient.estimateContractGas({
      address: FACTORY_ADDRESS,
      abi: FACTORY_ABI,
      functionName: "createMarket",
      args: [
        MARKET.question,
        MARKET.category,
        MARKET.externalId,
        MARKET.endTime,
        MARKET.liquidityParam,
      ],
      account: account.address,
    });
    console.log(`\n⛽ Estimated gas: ${gasEstimate.toLocaleString()} units`);
  } catch (err) {
    console.error(`\n❌ Gas estimation failed — contract may have reverted.`);
    console.error(`   This usually means endTime is in the past or duplicate externalId.`);
    console.error(err);
    process.exit(1);
  }

  const gasPrice = await publicClient.getGasPrice(); // 5 gwei — standard on Celo
  const estimatedCost = Number(gasEstimate * gasPrice) / 1e18;
  console.log(`💸 Estimated cost: ${estimatedCost.toFixed(6)} CELO`);

  if (estimatedCost > balanceCelo) {
    console.error(
      `\n❌ Insufficient funds. Need ${estimatedCost.toFixed(6)} CELO, have ${balanceCelo.toFixed(6)} CELO`
    );
    process.exit(1);
  }

  // ── Send transaction ─────────────────────────────────────────────────────
  console.log(`\n🚀 Sending transaction...`);

  const hash = await walletClient.writeContract({
    address: FACTORY_ADDRESS,
    abi: FACTORY_ABI,
    functionName: "createMarket",
    args: [
      MARKET.question,
      MARKET.category,
      MARKET.externalId,
      MARKET.endTime,
      MARKET.liquidityParam,
    ],
    gas: gasEstimate + gasEstimate / 10n, // +10% buffer
    gasPrice,
  });

  console.log(`✅ TX sent: https://celoscan.io/tx/${hash}`);
  console.log(`⏳ Waiting for confirmation...`);

  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  console.log(`\n🎉 Market created!`);
  console.log(`   Block:    ${receipt.blockNumber}`);
  console.log(`   Gas used: ${receipt.gasUsed.toLocaleString()}`);
  console.log(
    `   Actual cost: ${(Number(receipt.gasUsed * gasPrice) / 1e18).toFixed(6)} CELO`
  );

  // ── Extract market address from logs ────────────────────────────────────
  // MarketCreated event topic
  const MARKET_CREATED_TOPIC =
    "0x" +
    Buffer.from(
      "MarketCreated(uint256,address,string,string,string,uint256)"
    ).toString("hex");

  const log = receipt.logs[receipt.logs.length - 1];
  if (log) {
    console.log(`\n📌 Market proxy address: ${log.address}`);
    console.log(
      `   View on Celoscan: https://celoscan.io/address/${log.address}`
    );
  }

  console.log(`\n📋 Next: run your indexer — it will pick up this market automatically.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});