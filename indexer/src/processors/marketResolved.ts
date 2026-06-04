import { ethers, Log } from "ethers";
import { eq } from "drizzle-orm";
import { db } from "../db/client";
import { markets } from "../db/schema";
import { marketIface } from "../eventFetcher";
import { publishMarketResolved } from "../redis";

/**
 * Handles MarketResolved events emitted by PredictionMarket.
 *
 * event MarketResolved(uint8 winningOutcome, uint256 timestamp)
 */
export async function processMarketResolved(
  log: Log,
  marketAddress: string,
  provider: ethers.JsonRpcProvider
): Promise<void> {
  const parsed = marketIface.parseLog({ topics: [...log.topics], data: log.data });
  if (!parsed) return;

  const winningOutcome = Number(parsed.args.winningOutcome); // 0=NO, 1=YES
  const resolvedAt     = new Date(Number(parsed.args.timestamp) * 1000);

  // Lookup market by address
  const marketRows = await db
    .select({ id: markets.id })
    .from(markets)
    .where(eq(markets.address, marketAddress.toLowerCase()))
    .limit(1);

  if (marketRows.length === 0) {
    console.warn(`⚠️  Resolution for unknown market ${marketAddress} — skipping`);
    return;
  }

  const marketId = marketRows[0].id;

  await db
    .update(markets)
    .set({
      resolved:        true,
      winningOutcome,
      resolvedAt,
      resolvedTxHash:  log.transactionHash,
    })
    .where(eq(markets.id, marketId));

  // Publish resolution event — API will push to frontend subscribers
  await publishMarketResolved({
    marketId,
    winningOutcome,
    timestamp: Math.floor(resolvedAt.getTime() / 1000),
  });

  console.log(
    `🏁 Market #${marketId} resolved | winner: ${winningOutcome === 1 ? "YES" : "NO"}`
  );
}