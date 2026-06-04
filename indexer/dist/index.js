"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const ethers_1 = require("ethers");
const client_1 = require("./db/client");
const schema_1 = require("./db/schema");
const eventFetcher_1 = require("./eventFetcher");
const blockTracker_1 = require("./blockTracker");
const marketCreated_1 = require("./processors/marketCreated");
const sharesTrade_1 = require("./processors/sharesTrade");
const marketResolved_1 = require("./processors/marketResolved");
const redeemed_1 = require("./processors/redeemed");
// ─── Config ───────────────────────────────────────────────────────────────────
const CELO_RPC = process.env.CELO_RPC_URL ?? "https://forno.celo.org";
const FACTORY_ADDRESS = process.env.FACTORY_CONTRACT_ADDRESS ?? "";
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE ?? "500", 10);
const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS ?? "2000", 10);
if (!FACTORY_ADDRESS) {
    console.error("❌ FACTORY_CONTRACT_ADDRESS not set in .env");
    process.exit(1);
}
// ─── Provider with fallback ───────────────────────────────────────────────────
function buildProvider() {
    return new ethers_1.ethers.JsonRpcProvider(CELO_RPC, {
        chainId: 42220,
        name: "celo",
    });
}
// ─── Helpers ──────────────────────────────────────────────────────────────────
/** Fetch all known market proxy addresses from the DB */
async function getKnownMarketAddresses() {
    const rows = await client_1.db.select({ address: schema_1.markets.address }).from(schema_1.markets);
    return rows.map((r) => r.address);
}
function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}
// ─── Log dispatcher ───────────────────────────────────────────────────────────
async function processLog(log, provider) {
    const topic = log.topics[0];
    try {
        switch (topic) {
            case eventFetcher_1.EVENT_TOPICS.MarketCreated:
                await (0, marketCreated_1.processMarketCreated)(log, provider);
                break;
            case eventFetcher_1.EVENT_TOPICS.SharesBought:
                await (0, sharesTrade_1.processSharesBought)(log, log.address, provider);
                break;
            case eventFetcher_1.EVENT_TOPICS.SharesSold:
                await (0, sharesTrade_1.processSharesSold)(log, log.address, provider);
                break;
            case eventFetcher_1.EVENT_TOPICS.MarketResolved:
                await (0, marketResolved_1.processMarketResolved)(log, log.address, provider);
                break;
            case eventFetcher_1.EVENT_TOPICS.Redeemed:
                await (0, redeemed_1.processRedeemed)(log, log.address, provider);
                break;
            default:
                // Ignore unknown topics (shouldn't happen given our filter)
                break;
        }
    }
    catch (err) {
        // Log and continue — don't crash the indexer over a single bad event
        console.error(`❌ Error processing log tx=${log.transactionHash} topic=${topic}:`, err);
    }
}
// ─── Sort logs by block + logIndex ───────────────────────────────────────────
function sortLogs(logs) {
    return [...logs].sort((a, b) => {
        if (a.blockNumber !== b.blockNumber)
            return a.blockNumber - b.blockNumber;
        return a.index - b.index;
    });
}
// ─── Main loop ────────────────────────────────────────────────────────────────
async function run() {
    console.log("🚀 CeloMarket indexer starting...");
    console.log(`   RPC:     ${CELO_RPC}`);
    console.log(`   Factory: ${FACTORY_ADDRESS}`);
    console.log(`   Batch:   ${BATCH_SIZE} blocks | Poll: ${POLL_INTERVAL_MS}ms`);
    const provider = buildProvider();
    while (true) {
        try {
            const stored = await (0, blockTracker_1.getLastIndexedBlock)();
            const latestBlock = await provider.getBlockNumber();
            // ── Reorg check ────────────────────────────────────────────────────────
            const reorged = await (0, blockTracker_1.detectReorg)(provider, stored);
            if (reorged) {
                const safe = await (0, blockTracker_1.rollback)(stored.number);
                await (0, blockTracker_1.setLastIndexedBlock)(safe);
                await sleep(POLL_INTERVAL_MS);
                continue;
            }
            // ── Nothing new ────────────────────────────────────────────────────────
            if (latestBlock <= stored.number) {
                await sleep(POLL_INTERVAL_MS);
                continue;
            }
            const fromBlock = stored.number + 1;
            const toBlock = Math.min(latestBlock, stored.number + BATCH_SIZE);
            console.log(`📦 Indexing blocks ${fromBlock} → ${toBlock} (latest: ${latestBlock})`);
            // ── Fetch logs ─────────────────────────────────────────────────────────
            const marketAddresses = await getKnownMarketAddresses();
            const { factoryLogs, marketLogs } = await (0, eventFetcher_1.fetchLogs)(provider, FACTORY_ADDRESS, marketAddresses, fromBlock, toBlock);
            const allLogs = sortLogs([...factoryLogs, ...marketLogs]);
            // ── Process logs ───────────────────────────────────────────────────────
            for (const log of allLogs) {
                await processLog(log, provider);
            }
            // ── Advance tracker ────────────────────────────────────────────────────
            const toBlockData = await provider.getBlock(toBlock);
            await (0, blockTracker_1.setLastIndexedBlock)({
                number: toBlock,
                hash: toBlockData?.hash ?? "",
            });
            if (allLogs.length > 0) {
                console.log(`   ✔ Processed ${allLogs.length} events`);
            }
        }
        catch (err) {
            // Network hiccup — log and retry after poll interval
            console.error("⚠️  Poll error:", err.message);
        }
        await sleep(POLL_INTERVAL_MS);
    }
}
// ─── Entrypoint ───────────────────────────────────────────────────────────────
run().catch((err) => {
    console.error("Fatal indexer error:", err);
    process.exit(1);
});
