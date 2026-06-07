"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCacheClient = getCacheClient;
exports.getSubscriberClient = getSubscriberClient;
exports.getCachedMarket = getCachedMarket;
exports.setCachedMarket = setCachedMarket;
exports.closeRedis = closeRedis;
const ioredis_1 = __importDefault(require("ioredis"));
const config_1 = require("../config");
const format_1 = require("./format");
const PRICE_CACHE_TTL_SECONDS = 5;
let cacheClient = null;
let subscriberClient = null;
function createClient(label) {
    const client = new ioredis_1.default(config_1.config.redisUrl, {
        lazyConnect: true,
        maxRetriesPerRequest: 3,
    });
    client.on("error", (err) => {
        console.error(`Redis ${label} error:`, err.message);
    });
    return client;
}
function getCacheClient() {
    if (!cacheClient)
        cacheClient = createClient("cache");
    return cacheClient;
}
function getSubscriberClient() {
    if (!subscriberClient)
        subscriberClient = createClient("subscriber");
    return subscriberClient;
}
async function getCachedMarket(marketId) {
    try {
        const payload = await getCacheClient().get(`market:cache:${marketId}`);
        return payload ? JSON.parse(payload) : null;
    }
    catch {
        return null;
    }
}
async function setCachedMarket(market) {
    try {
        await getCacheClient().set(`market:cache:${market.id}`, JSON.stringify((0, format_1.serializeMarket)(market)), "EX", PRICE_CACHE_TTL_SECONDS);
    }
    catch {
        return;
    }
}
async function closeRedis() {
    const clients = [cacheClient, subscriberClient].filter((client) => !!client);
    await Promise.all(clients.map((client) => client.quit().catch(() => undefined)));
}
