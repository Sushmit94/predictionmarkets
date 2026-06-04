import { eq } from "drizzle-orm";
import { db } from "./db/client";
import { blockTracker } from "./db/schema";
import { Pool } from "pg";
export interface TrackedBlock {
  number: number;
  hash: string;
}

/**
 * Returns the last successfully indexed block.
 * Falls back to START_BLOCK env var if the tracker row doesn't exist yet.
 */
export async function getLastIndexedBlock(): Promise<TrackedBlock> {
  const rows = await db
    .select()
    .from(blockTracker)
    .where(eq(blockTracker.id, 1))
    .limit(1);

  if (rows.length === 0) {
    const startBlock = parseInt(process.env.START_BLOCK ?? "0", 10);
    return { number: startBlock, hash: "" };
  }

  return {
    number: rows[0].lastIndexedBlock,
    hash: rows[0].lastIndexedHash,
  };
}

/**
 * Persists the latest successfully indexed block + its hash.
 * Uses an UPSERT so the first call creates the single tracker row.
 */
export async function setLastIndexedBlock(block: TrackedBlock): Promise<void> {
  await db
    .insert(blockTracker)
    .values({
      id: 1,
      lastIndexedBlock: block.number,
      lastIndexedHash: block.hash,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: blockTracker.id,
      set: {
        lastIndexedBlock: block.number,
        lastIndexedHash: block.hash,
        updatedAt: new Date(),
      },
    });
}

/**
 * Reorg protection:
 * Fetches the on-chain hash for our stored block number.
 * If it doesn't match what we stored, a reorg has occurred.
 * Returns the number of blocks to roll back (or 0 if chain is consistent).
 */
export async function detectReorg(
  provider: import("ethers").JsonRpcProvider,
  stored: TrackedBlock
): Promise<boolean> {
  if (!stored.hash) return false; // nothing stored yet — no reorg possible

  try {
    const onChainBlock = await provider.getBlock(stored.number);
    if (!onChainBlock) return false;

    if (onChainBlock.hash !== stored.hash) {
      console.warn(
        `⚠️  Reorg detected at block ${stored.number}! ` +
          `Stored hash: ${stored.hash} | On-chain hash: ${onChainBlock.hash}`
      );
      return true;
    }
    return false;
  } catch {
    // RPC hiccup — don't treat as reorg, just skip this poll
    return false;
  }
}

/**
 * Roll back to REORG_DEPTH blocks before the reorg point.
 * Deletes trades and redemptions from those blocks so they get re-indexed.
 */
export async function rollback(
  reorgBlock: number,
  reorgDepth = 10
): Promise<TrackedBlock> {
  const safeBlock = Math.max(0, reorgBlock - reorgDepth);

  console.log(`🔄 Rolling back to block ${safeBlock} (reorg depth: ${reorgDepth})`);

  // Delete events that may have been from the orphaned chain
// ✅ Correct — use the pg pool directly


const pool = new Pool({ connectionString: process.env.DATABASE_URL });
await pool.query(`DELETE FROM trades WHERE block_number > $1`, [safeBlock]);
await pool.query(`DELETE FROM redemptions WHERE block_number > $1`, [safeBlock]);
  // Note: market creation is rare — leave markets table intact for now.
  // A full rollback strategy for MarketCreated would reset resolved/price fields.

  return { number: safeBlock, hash: "" };
}