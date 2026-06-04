import "dotenv/config";
import { ethers } from "ethers";
import { eq } from "drizzle-orm";

import { db }                 from "./db/client";
import { markets }            from "./db/schema";
import { fetchLogs, EVENT_TOPICS } from "./eventFetcher";
import {
  getLastIndexedBlock,
  setLastIndexedBlock,
  detectReorg,
  rollback,
} from "./blockTracker";
import { processMarketCreated }          from "./processors/marketCreated";
import { processSharesBought, processSharesSold } from "./processors/sharesTrade";
import { processMarketResolved }         from "./processors/marketResolved";
import { processRedeemed }               from "./processors/redeemed";

// ─── Config ───────────────────────────────────────────────────────────────────

const CELO_RPC         = process.env.CELO_RPC_URL         ?? "https://forno.celo.org";
const FACTORY_ADDRESS  = process.env.FACTORY_CONTRACT_ADDRESS ?? "";
const BATCH_SIZE       = parseInt(process.env.BATCH_SIZE       ?? "500", 10);
const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS ?? "2000", 10);

if (!FACTORY_ADDRESS) {
  console.error("❌ FACTORY_CONTRACT_ADDRESS not set in .env");
  process.exit(1);
}

// ─── Provider with fallback ───────────────────────────────────────────────────

function buildProvider(): ethers.JsonRpcProvider {
  return new ethers.JsonRpcProvider(CELO_RPC, {
    chainId: 42220,
    name: "celo",
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Fetch all known market proxy addresses from the DB */
async function getKnownMarketAddresses(): Promise<string[]> {
  const rows = await db.select({ address: markets.address }).from(markets);
  return rows.map((r) => r.address);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ─── Log dispatcher ───────────────────────────────────────────────────────────

async function processLog(
  log: ethers.Log,
  provider: ethers.JsonRpcProvider
): Promise<void> {
  const topic = log.topics[0];

  try {
    switch (topic) {
      case EVENT_TOPICS.MarketCreated:
        await processMarketCreated(log, provider);
        break;

      case EVENT_TOPICS.SharesBought:
        await processSharesBought(log, log.address, provider);
        break;

      case EVENT_TOPICS.SharesSold:
        await processSharesSold(log, log.address, provider);
        break;

      case EVENT_TOPICS.MarketResolved:
        await processMarketResolved(log, log.address, provider);
        break;

      case EVENT_TOPICS.Redeemed:
        await processRedeemed(log, log.address, provider);
        break;

      default:
        // Ignore unknown topics (shouldn't happen given our filter)
        break;
    }
  } catch (err) {
    // Log and continue — don't crash the indexer over a single bad event
    console.error(`❌ Error processing log tx=${log.transactionHash} topic=${topic}:`, err);
  }
}

// ─── Sort logs by block + logIndex ───────────────────────────────────────────

function sortLogs(logs: ethers.Log[]): ethers.Log[] {
  return [...logs].sort((a, b) => {
    if (a.blockNumber !== b.blockNumber) return a.blockNumber - b.blockNumber;
    return a.index - b.index;
  });
}

// ─── Main loop ────────────────────────────────────────────────────────────────

async function run(): Promise<void> {
  console.log("🚀 CeloMarket indexer starting...");
  console.log(`   RPC:     ${CELO_RPC}`);
  console.log(`   Factory: ${FACTORY_ADDRESS}`);
  console.log(`   Batch:   ${BATCH_SIZE} blocks | Poll: ${POLL_INTERVAL_MS}ms`);

  const provider = buildProvider();

  while (true) {
    try {
      const stored      = await getLastIndexedBlock();
      const latestBlock = await provider.getBlockNumber();

      // ── Reorg check ────────────────────────────────────────────────────────
      const reorged = await detectReorg(provider, stored);
      if (reorged) {
        const safe = await rollback(stored.number);
        await setLastIndexedBlock(safe);
        await sleep(POLL_INTERVAL_MS);
        continue;
      }

      // ── Nothing new ────────────────────────────────────────────────────────
      if (latestBlock <= stored.number) {
        await sleep(POLL_INTERVAL_MS);
        continue;
      }

      const fromBlock = stored.number + 1;
      const toBlock   = Math.min(latestBlock, stored.number + BATCH_SIZE);

      console.log(`📦 Indexing blocks ${fromBlock} → ${toBlock} (latest: ${latestBlock})`);

      // ── Fetch logs ─────────────────────────────────────────────────────────
      const marketAddresses = await getKnownMarketAddresses();

      const { factoryLogs, marketLogs } = await fetchLogs(
        provider,
        FACTORY_ADDRESS,
        marketAddresses,
        fromBlock,
        toBlock
      );

      const allLogs = sortLogs([...factoryLogs, ...marketLogs]);

      // ── Process logs ───────────────────────────────────────────────────────
      for (const log of allLogs) {
        await processLog(log, provider);
      }

      // ── Advance tracker ────────────────────────────────────────────────────
      const toBlockData = await provider.getBlock(toBlock);
      await setLastIndexedBlock({
        number: toBlock,
        hash:   toBlockData?.hash ?? "",
      });

      if (allLogs.length > 0) {
        console.log(`   ✔ Processed ${allLogs.length} events`);
      }
    } catch (err) {
      // Network hiccup — log and retry after poll interval
      console.error("⚠️  Poll error:", (err as Error).message);
    }

    await sleep(POLL_INTERVAL_MS);
  }
}

// ─── Entrypoint ───────────────────────────────────────────────────────────────

run().catch((err) => {
  console.error("Fatal indexer error:", err);
  process.exit(1);
});