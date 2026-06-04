import Redis from "ioredis";
import { config } from "../config";
import { serializeMarket } from "./format";
import type { Market } from "../db/schema";

const PRICE_CACHE_TTL_SECONDS = 5;

let cacheClient: Redis | null = null;
let subscriberClient: Redis | null = null;

function createClient(label: string): Redis {
  const client = new Redis(config.redisUrl, {
    lazyConnect: true,
    maxRetriesPerRequest: 3,
  });

  client.on("error", (err) => {
    console.error(`Redis ${label} error:`, err.message);
  });

  return client;
}

export function getCacheClient(): Redis {
  if (!cacheClient) cacheClient = createClient("cache");
  return cacheClient;
}

export function getSubscriberClient(): Redis {
  if (!subscriberClient) subscriberClient = createClient("subscriber");
  return subscriberClient;
}

export async function getCachedMarket(marketId: string) {
  try {
    const payload = await getCacheClient().get(`market:cache:${marketId}`);
    return payload ? JSON.parse(payload) : null;
  } catch {
    return null;
  }
}

export async function setCachedMarket(market: Market): Promise<void> {
  try {
    await getCacheClient().set(
      `market:cache:${market.id}`,
      JSON.stringify(serializeMarket(market)),
      "EX",
      PRICE_CACHE_TTL_SECONDS
    );
  } catch {
    return;
  }
}

export async function closeRedis(): Promise<void> {
  const clients = [cacheClient, subscriberClient].filter((client): client is Redis => !!client);
  await Promise.all(clients.map((client) => client.quit().catch(() => undefined)));
}
