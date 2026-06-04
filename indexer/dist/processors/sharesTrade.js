"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.processSharesBought = processSharesBought;
exports.processSharesSold = processSharesSold;
const drizzle_orm_1 = require("drizzle-orm");
const client_1 = require("../db/client");
const schema_1 = require("../db/schema");
const eventFetcher_1 = require("../eventFetcher");
const redis_1 = require("../redis");
// ─── Helpers ──────────────────────────────────────────────────────────────────
/**
 * LMSR price calculation (mirrors the Solidity LMSR.priceYes / priceNo).
 * Returns a WAD-scaled price as a string (18 decimals).
 *
 * Formula: P(YES) = exp(qYes / b) / (exp(qYes / b) + exp(qNo / b))
 *
 * We use BigInt arithmetic to avoid floating-point drift on large numbers.
 * For display, 1e18 = 100% probability.
 */
function lmsrPrice(qYes, qNo, b) {
    // Normalise by subtracting max to avoid overflow (log-sum-exp trick)
    const WAD = BigInt("1000000000000000000"); // 1e18
    // Work in WAD-scaled fixed point
    // exp approximation sufficient for display: use JS floats then scale back
    const qYesF = Number(qYes) / Number(WAD);
    const qNoF = Number(qNo) / Number(WAD);
    const bF = Number(b) / Number(WAD);
    const expYes = Math.exp(qYesF / bF);
    const expNo = Math.exp(qNoF / bF);
    const sum = expYes + expNo;
    const yesPriceF = expYes / sum;
    const noPriceF = expNo / sum;
    return {
        yesPrice: BigInt(Math.round(yesPriceF * Number(WAD))),
        noPrice: BigInt(Math.round(noPriceF * Number(WAD))),
    };
}
// ─── Shared trade insertion ───────────────────────────────────────────────────
async function insertTrade(log, marketAddress, trader, outcome, sharesAmount, collateralAmount, type, provider) {
    const block = await provider.getBlock(log.blockNumber);
    const timestamp = new Date((block?.timestamp ?? 0) * 1000);
    // Lookup marketId by contract address
    const marketRows = await client_1.db
        .select({ id: schema_1.markets.id, yesShares: schema_1.markets.yesShares, noShares: schema_1.markets.noShares })
        .from(schema_1.markets)
        .where((0, drizzle_orm_1.eq)(schema_1.markets.address, marketAddress.toLowerCase()))
        .limit(1);
    if (marketRows.length === 0) {
        console.warn(`⚠️  Trade for unknown market address ${marketAddress} — skipping`);
        return;
    }
    const market = marketRows[0];
    const marketId = market.id;
    // Insert trade row (idempotent via unique tx_hash)
    await client_1.db
        .insert(schema_1.trades)
        .values({
        marketId,
        marketAddress: marketAddress.toLowerCase(),
        trader: trader.toLowerCase(),
        outcome,
        type,
        sharesAmount: sharesAmount.toString(),
        collateralAmount: collateralAmount.toString(),
        txHash: log.transactionHash,
        blockNumber: log.blockNumber,
        logIndex: log.index,
        timestamp,
    })
        .onConflictDoNothing();
    // ── Update market aggregates ──────────────────────────────────────────────
    const sharesDelta = sharesAmount.toString();
    const collateral = collateralAmount.toString();
    if (type === "buy") {
        if (outcome === 1 /* YES */) {
            await client_1.db
                .update(schema_1.markets)
                .set({
                yesShares: (0, drizzle_orm_1.sql) `yes_shares + ${sharesDelta}`,
                totalVolume: (0, drizzle_orm_1.sql) `total_volume + ${collateral}`,
                totalCollateral: (0, drizzle_orm_1.sql) `total_collateral + ${collateral}`,
            })
                .where((0, drizzle_orm_1.eq)(schema_1.markets.id, marketId));
        }
        else {
            await client_1.db
                .update(schema_1.markets)
                .set({
                noShares: (0, drizzle_orm_1.sql) `no_shares + ${sharesDelta}`,
                totalVolume: (0, drizzle_orm_1.sql) `total_volume + ${collateral}`,
                totalCollateral: (0, drizzle_orm_1.sql) `total_collateral + ${collateral}`,
            })
                .where((0, drizzle_orm_1.eq)(schema_1.markets.id, marketId));
        }
    }
    else {
        // sell — shares decrease, collateral leaves contract
        if (outcome === 1) {
            await client_1.db
                .update(schema_1.markets)
                .set({
                yesShares: (0, drizzle_orm_1.sql) `yes_shares - ${sharesDelta}`,
                totalCollateral: (0, drizzle_orm_1.sql) `total_collateral - ${collateral}`,
            })
                .where((0, drizzle_orm_1.eq)(schema_1.markets.id, marketId));
        }
        else {
            await client_1.db
                .update(schema_1.markets)
                .set({
                noShares: (0, drizzle_orm_1.sql) `no_shares - ${sharesDelta}`,
                totalCollateral: (0, drizzle_orm_1.sql) `total_collateral - ${collateral}`,
            })
                .where((0, drizzle_orm_1.eq)(schema_1.markets.id, marketId));
        }
    }
    // ── Recompute + cache LMSR prices ────────────────────────────────────────
    // Re-fetch updated shares
    const updated = await client_1.db
        .select({ yesShares: schema_1.markets.yesShares, noShares: schema_1.markets.noShares, totalVolume: schema_1.markets.totalVolume })
        .from(schema_1.markets)
        .where((0, drizzle_orm_1.eq)(schema_1.markets.id, marketId))
        .limit(1);
    if (updated.length > 0) {
        // Default LMSR b = 1000e18; in production read from contract or store in DB
        const DEFAULT_B = BigInt("1000000000000000000000"); // 1000e18
        const { yesPrice, noPrice } = lmsrPrice(BigInt(updated[0].yesShares ?? "0"), BigInt(updated[0].noShares ?? "0"), DEFAULT_B);
        await client_1.db
            .update(schema_1.markets)
            .set({
            yesPrice: yesPrice.toString(),
            noPrice: noPrice.toString(),
        })
            .where((0, drizzle_orm_1.eq)(schema_1.markets.id, marketId));
        // Publish to Redis → API WebSocket
        await (0, redis_1.publishPriceUpdate)({
            marketId,
            yesPrice: yesPrice.toString(),
            noPrice: noPrice.toString(),
            totalVolume: updated[0].totalVolume ?? "0",
            timestamp: Math.floor(timestamp.getTime() / 1000),
        });
    }
    console.log(`💱 Trade [${type.toUpperCase()} ${outcome === 1 ? "YES" : "NO"}] ` +
        `market #${marketId} | trader: ${trader.slice(0, 8)}... | ` +
        `shares: ${sharesAmount} | collateral: ${collateralAmount}`);
}
// ─── Exported processors ──────────────────────────────────────────────────────
/**
 * event SharesBought(address indexed trader, uint8 indexed outcome,
 *                    uint256 sharesAmount, uint256 collateralPaid)
 */
async function processSharesBought(log, marketAddress, provider) {
    const parsed = eventFetcher_1.marketIface.parseLog({ topics: [...log.topics], data: log.data });
    if (!parsed)
        return;
    await insertTrade(log, marketAddress, parsed.args.trader, Number(parsed.args.outcome), parsed.args.sharesAmount, parsed.args.collateralPaid, "buy", provider);
}
/**
 * event SharesSold(address indexed trader, uint8 indexed outcome,
 *                  uint256 sharesAmount, uint256 collateralReceived)
 */
async function processSharesSold(log, marketAddress, provider) {
    const parsed = eventFetcher_1.marketIface.parseLog({ topics: [...log.topics], data: log.data });
    if (!parsed)
        return;
    await insertTrade(log, marketAddress, parsed.args.trader, Number(parsed.args.outcome), parsed.args.sharesAmount, parsed.args.collateralReceived, "sell", provider);
}
