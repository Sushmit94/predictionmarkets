import Redis from "ioredis";

let publisher: Redis | null = null;

export function getPublisher(): Redis {
  if (!publisher) {
    publisher = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
      lazyConnect: true,
      maxRetriesPerRequest: 3,
    });

    publisher.on("error", (err) => {
      console.error("Redis publish error:", err.message);
    });
  }
  return publisher;
}

/**
 * Publish a price update for a market.
 * The API's WebSocket server subscribes to these channels and pushes to clients.
 *
 * Channel: market:price:<marketId>
 * Payload: { marketId, yesPrice, noPrice, totalVolume, timestamp }
 */
export async function publishPriceUpdate(payload: {
  marketId: string;
  yesPrice: string;
  noPrice: string;
  totalVolume: string;
  timestamp: number;
}): Promise<void> {
  try {
    await getPublisher().publish(
      `market:price:${payload.marketId}`,
      JSON.stringify(payload)
    );
  } catch (err) {
    // Non-fatal — indexer must not crash if Redis is temporarily down
    console.error(`Failed to publish price update for market ${payload.marketId}:`, err);
  }
}

/**
 * Publish a market resolution event.
 * Channel: market:resolved:<marketId>
 */
export async function publishMarketResolved(payload: {
  marketId: string;
  winningOutcome: number;
  timestamp: number;
}): Promise<void> {
  try {
    await getPublisher().publish(
      `market:resolved:${payload.marketId}`,
      JSON.stringify(payload)
    );
  } catch (err) {
    console.error(`Failed to publish resolution for market ${payload.marketId}:`, err);
  }
}