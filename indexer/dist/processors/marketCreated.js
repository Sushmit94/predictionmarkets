"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.processMarketCreated = processMarketCreated;
const client_1 = require("../db/client");
const schema_1 = require("../db/schema");
const eventFetcher_1 = require("../eventFetcher");
/**
 * Handles MarketCreated events emitted by MarketFactory.
 *
 * event MarketCreated(
 *   uint256 indexed marketId,
 *   address indexed marketAddress,
 *   string  question,
 *   string  category,
 *   string  externalId,
 *   uint256 endTime
 * )
 */
async function processMarketCreated(log, provider) {
    const parsed = eventFetcher_1.factoryIface.parseLog({ topics: [...log.topics], data: log.data });
    if (!parsed)
        return;
    const marketId = parsed.args.marketId.toString();
    const marketAddress = parsed.args.marketAddress.toLowerCase();
    const question = parsed.args.question;
    const category = parsed.args.category;
    const externalId = parsed.args.externalId;
    const endTime = new Date(Number(parsed.args.endTime) * 1000);
    // Fetch block timestamp for createdAt
    const block = await provider.getBlock(log.blockNumber);
    const createdAt = new Date((block?.timestamp ?? 0) * 1000);
    await client_1.db
        .insert(schema_1.markets)
        .values({
        id: marketId,
        address: marketAddress,
        question,
        category: category || null,
        externalId: externalId || null,
        endTime,
        createdAt,
        createdTxHash: log.transactionHash,
        yesShares: "0",
        noShares: "0",
        yesPrice: "500000000000000000", // 0.5 WAD — initial LMSR price
        noPrice: "500000000000000000",
        totalVolume: "0",
        totalCollateral: "0",
        resolved: false,
        winningOutcome: null,
    })
        .onConflictDoNothing(); // idempotent — safe to re-process
    console.log(`✅ Market #${marketId} created | ${marketAddress} | "${question}"`);
}
