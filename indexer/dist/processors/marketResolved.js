"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.processMarketResolved = processMarketResolved;
const drizzle_orm_1 = require("drizzle-orm");
const client_1 = require("../db/client");
const schema_1 = require("../db/schema");
const eventFetcher_1 = require("../eventFetcher");
const redis_1 = require("../redis");
/**
 * Handles MarketResolved events emitted by PredictionMarket.
 *
 * event MarketResolved(uint8 winningOutcome, uint256 timestamp)
 */
async function processMarketResolved(log, marketAddress, provider) {
    const parsed = eventFetcher_1.marketIface.parseLog({ topics: [...log.topics], data: log.data });
    if (!parsed)
        return;
    const winningOutcome = Number(parsed.args.winningOutcome); // 0=NO, 1=YES
    const resolvedAt = new Date(Number(parsed.args.timestamp) * 1000);
    // Lookup market by address
    const marketRows = await client_1.db
        .select({ id: schema_1.markets.id })
        .from(schema_1.markets)
        .where((0, drizzle_orm_1.eq)(schema_1.markets.address, marketAddress.toLowerCase()))
        .limit(1);
    if (marketRows.length === 0) {
        console.warn(`⚠️  Resolution for unknown market ${marketAddress} — skipping`);
        return;
    }
    const marketId = marketRows[0].id;
    await client_1.db
        .update(schema_1.markets)
        .set({
        resolved: true,
        winningOutcome,
        resolvedAt,
        resolvedTxHash: log.transactionHash,
    })
        .where((0, drizzle_orm_1.eq)(schema_1.markets.id, marketId));
    // Publish resolution event — API will push to frontend subscribers
    await (0, redis_1.publishMarketResolved)({
        marketId,
        winningOutcome,
        timestamp: Math.floor(resolvedAt.getTime() / 1000),
    });
    console.log(`🏁 Market #${marketId} resolved | winner: ${winningOutcome === 1 ? "YES" : "NO"}`);
}
