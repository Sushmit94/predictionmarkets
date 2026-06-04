import { ethers, Log } from "ethers";
import { eq } from "drizzle-orm";
import { db } from "../db/client";
import { markets, redemptions } from "../db/schema";
import { marketIface } from "../eventFetcher";

/**
 * Handles Redeemed events emitted by PredictionMarket.
 *
 * event Redeemed(address indexed trader, uint256 collateralAmount)
 */
export async function processRedeemed(
  log: Log,
  marketAddress: string,
  provider: ethers.JsonRpcProvider
): Promise<void> {
  const parsed = marketIface.parseLog({ topics: [...log.topics], data: log.data });
  if (!parsed) return;

  const trader          = (parsed.args.trader as string).toLowerCase();
  const collateralAmount = (parsed.args.collateralAmount as bigint).toString();

  const block     = await provider.getBlock(log.blockNumber);
  const timestamp = new Date((block?.timestamp ?? 0) * 1000);

  // Lookup market
  const marketRows = await db
    .select({ id: markets.id })
    .from(markets)
    .where(eq(markets.address, marketAddress.toLowerCase()))
    .limit(1);

  if (marketRows.length === 0) {
    console.warn(`⚠️  Redemption for unknown market ${marketAddress} — skipping`);
    return;
  }

  const marketId = marketRows[0].id;

  await db
    .insert(redemptions)
    .values({
      marketId,
      marketAddress: marketAddress.toLowerCase(),
      trader,
      collateralAmount,
      txHash:      log.transactionHash,
      blockNumber: log.blockNumber,
      timestamp,
    })
    .onConflictDoNothing();

  console.log(
    `💰 Redemption | market #${marketId} | trader: ${trader.slice(0, 8)}... | G$: ${collateralAmount}`
  );
}