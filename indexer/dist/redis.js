"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPublisher = getPublisher;
exports.publishPriceUpdate = publishPriceUpdate;
exports.publishMarketResolved = publishMarketResolved;
const ioredis_1 = __importDefault(require("ioredis"));
let publisher = null;
function getPublisher() {
    if (!publisher) {
        publisher = new ioredis_1.default(process.env.REDIS_URL ?? "redis://localhost:6379", {
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
async function publishPriceUpdate(payload) {
    try {
        await getPublisher().publish(`market:price:${payload.marketId}`, JSON.stringify(payload));
    }
    catch (err) {
        // Non-fatal — indexer must not crash if Redis is temporarily down
        console.error(`Failed to publish price update for market ${payload.marketId}:`, err);
    }
}
/**
 * Publish a market resolution event.
 * Channel: market:resolved:<marketId>
 */
async function publishMarketResolved(payload) {
    try {
        await getPublisher().publish(`market:resolved:${payload.marketId}`, JSON.stringify(payload));
    }
    catch (err) {
        console.error(`Failed to publish resolution for market ${payload.marketId}:`, err);
    }
}
