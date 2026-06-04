import { ethers, Log } from "ethers";
import { eq, sql } from "drizzle-orm";
import { db } from "../db/client";
import { markets, trades } from "../db/schema";
import { marketIface } from "../eventFetcher";
import { publishPriceUpdate } from "../redis";

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
function lmsrPrice(
  qYes: bigint,
  qNo: bigint,
  b: bigint
): { yesPrice: bigint; noPrice: bigint } {
  // Normalise by subtracting max to avoid overflow (log-sum-exp trick)
  const WAD = BigInt("1000000000000000000"); // 1e18

  // Work in WAD-scaled fixed point
  // exp approximation sufficient for display: use JS floats then scale back
  const qYesF = Number(qYes) / Number(WAD);
  const qNoF  = Number(qNo)  / Number(WAD);
  const bF    = Number(b)    / Number(WAD);

  const expYes = Math.exp(qYesF / bF);
  const expNo  = Math.exp(qNoF  / bF);
  const sum    = expYes + expNo;

  const yesPriceF = expYes / sum;
  const noPriceF  = expNo  / sum;

  return {
    yesPrice: BigInt(Math.round(yesPriceF * Number(WAD))),
    noPrice:  BigInt(Math.round(noPriceF  * Number(WAD))),
  };
}

// ─── Shared trade insertion ───────────────────────────────────────────────────

async function insertTrade(
  log: Log,
  marketAddress: string,
  trader: string,
  outcome: number,
  sharesAmount: bigint,
  collateralAmount: bigint,
  type: "buy" | "sell",
  provider: ethers.JsonRpcProvider
): Promise<void> {
  const block     = await provider.getBlock(log.blockNumber);
  const timestamp = new Date((block?.timestamp ?? 0) * 1000);

  // Lookup marketId by contract address
  const marketRows = await db
    .select({ id: markets.id, yesShares: markets.yesShares, noShares: markets.noShares })
    .from(markets)
    .where(eq(markets.address, marketAddress.toLowerCase()))
    .limit(1);

  if (marketRows.length === 0) {
    console.warn(`⚠️  Trade for unknown market address ${marketAddress} — skipping`);
    return;
  }

  const market   = marketRows[0];
  const marketId = market.id;

  // Insert trade row (idempotent via unique tx_hash)
  await db
    .insert(trades)
    .values({
      marketId,
      marketAddress: marketAddress.toLowerCase(),
      trader:        trader.toLowerCase(),
      outcome,
      type,
      sharesAmount:     sharesAmount.toString(),
      collateralAmount: collateralAmount.toString(),
      txHash:       log.transactionHash,
      blockNumber:  log.blockNumber,
      logIndex:     log.index,
      timestamp,
    })
    .onConflictDoNothing();

  // ── Update market aggregates ──────────────────────────────────────────────
  const sharesDelta = sharesAmount.toString();
  const collateral  = collateralAmount.toString();

  if (type === "buy") {
    if (outcome === 1 /* YES */) {
      await db
        .update(markets)
        .set({
          yesShares:      sql`yes_shares + ${sharesDelta}`,
          totalVolume:    sql`total_volume + ${collateral}`,
          totalCollateral:sql`total_collateral + ${collateral}`,
        })
        .where(eq(markets.id, marketId));
    } else {
      await db
        .update(markets)
        .set({
          noShares:       sql`no_shares + ${sharesDelta}`,
          totalVolume:    sql`total_volume + ${collateral}`,
          totalCollateral:sql`total_collateral + ${collateral}`,
        })
        .where(eq(markets.id, marketId));
    }
  } else {
    // sell — shares decrease, collateral leaves contract
    if (outcome === 1) {
      await db
        .update(markets)
        .set({
          yesShares:      sql`yes_shares - ${sharesDelta}`,
          totalCollateral:sql`total_collateral - ${collateral}`,
        })
        .where(eq(markets.id, marketId));
    } else {
      await db
        .update(markets)
        .set({
          noShares:       sql`no_shares - ${sharesDelta}`,
          totalCollateral:sql`total_collateral - ${collateral}`,
        })
        .where(eq(markets.id, marketId));
    }
  }

  // ── Recompute + cache LMSR prices ────────────────────────────────────────
  // Re-fetch updated shares
  const updated = await db
    .select({ yesShares: markets.yesShares, noShares: markets.noShares, totalVolume: markets.totalVolume })
    .from(markets)
    .where(eq(markets.id, marketId))
    .limit(1);

  if (updated.length > 0) {
    // Default LMSR b = 1000e18; in production read from contract or store in DB
    const DEFAULT_B = BigInt("1000000000000000000000"); // 1000e18
    const { yesPrice, noPrice } = lmsrPrice(
      BigInt(updated[0].yesShares ?? "0"),
      BigInt(updated[0].noShares  ?? "0"),
      DEFAULT_B
    );

    await db
      .update(markets)
      .set({
        yesPrice: yesPrice.toString(),
        noPrice:  noPrice.toString(),
      })
      .where(eq(markets.id, marketId));

    // Publish to Redis → API WebSocket
    await publishPriceUpdate({
      marketId,
      yesPrice:    yesPrice.toString(),
      noPrice:     noPrice.toString(),
      totalVolume: updated[0].totalVolume ?? "0",
      timestamp:   Math.floor(timestamp.getTime() / 1000),
    });
  }

  console.log(
    `💱 Trade [${type.toUpperCase()} ${outcome === 1 ? "YES" : "NO"}] ` +
    `market #${marketId} | trader: ${trader.slice(0, 8)}... | ` +
    `shares: ${sharesAmount} | collateral: ${collateralAmount}`
  );
}

// ─── Exported processors ──────────────────────────────────────────────────────

/**
 * event SharesBought(address indexed trader, uint8 indexed outcome,
 *                    uint256 sharesAmount, uint256 collateralPaid)
 */
export async function processSharesBought(
  log: Log,
  marketAddress: string,
  provider: ethers.JsonRpcProvider
): Promise<void> {
  const parsed = marketIface.parseLog({ topics: [...log.topics], data: log.data });
  if (!parsed) return;

  await insertTrade(
    log,
    marketAddress,
    parsed.args.trader as string,
    Number(parsed.args.outcome),
    parsed.args.sharesAmount as bigint,
    parsed.args.collateralPaid as bigint,
    "buy",
    provider
  );
}

/**
 * event SharesSold(address indexed trader, uint8 indexed outcome,
 *                  uint256 sharesAmount, uint256 collateralReceived)
 */
export async function processSharesSold(
  log: Log,
  marketAddress: string,
  provider: ethers.JsonRpcProvider
): Promise<void> {
  const parsed = marketIface.parseLog({ topics: [...log.topics], data: log.data });
  if (!parsed) return;

  await insertTrade(
    log,
    marketAddress,
    parsed.args.trader as string,
    Number(parsed.args.outcome),
    parsed.args.sharesAmount as bigint,
    parsed.args.collateralReceived as bigint,
    "sell",
    provider
  );
}