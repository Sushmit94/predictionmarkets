"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.processRedeemed = processRedeemed;
const drizzle_orm_1 = require("drizzle-orm");
const client_1 = require("../db/client");
const schema_1 = require("../db/schema");
const eventFetcher_1 = require("../eventFetcher");
/**
 * Handles Redeemed events emitted by PredictionMarket.
 *
 * event Redeemed(address indexed trader, uint256 collateralAmount)
 */
async function processRedeemed(log, marketAddress, provider) {
    const parsed = eventFetcher_1.marketIface.parseLog({ topics: [...log.topics], data: log.data });
    if (!parsed)
        return;
    const trader = parsed.args.trader.toLowerCase();
    const collateralAmount = parsed.args.collateralAmount.toString();
    const block = await provider.getBlock(log.blockNumber);
    const timestamp = new Date((block?.timestamp ?? 0) * 1000);
    // Lookup market
    const marketRows = await client_1.db
        .select({ id: schema_1.markets.id })
        .from(schema_1.markets)
        .where((0, drizzle_orm_1.eq)(schema_1.markets.address, marketAddress.toLowerCase()))
        .limit(1);
    if (marketRows.length === 0) {
        console.warn(`⚠️  Redemption for unknown market ${marketAddress} — skipping`);
        return;
    }
    const marketId = marketRows[0].id;
    await client_1.db
        .insert(schema_1.redemptions)
        .values({
        marketId,
        marketAddress: marketAddress.toLowerCase(),
        trader,
        collateralAmount,
        txHash: log.transactionHash,
        blockNumber: log.blockNumber,
        timestamp,
    })
        .onConflictDoNothing();
    console.log(`💰 Redemption | market #${marketId} | trader: ${trader.slice(0, 8)}... | G$: ${collateralAmount}`);
}
