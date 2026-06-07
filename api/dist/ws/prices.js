"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerPriceWs = registerPriceWs;
const redis_1 = require("../lib/redis");
const OPEN_STATE = 1;
const clients = new Set();
function parseMarketIds(input) {
    if (Array.isArray(input)) {
        return input.map(String).filter(Boolean);
    }
    if (typeof input === "string") {
        return input.split(",").map((id) => id.trim()).filter(Boolean);
    }
    return [];
}
function sendJson(client, payload) {
    if (client.socket.readyState === OPEN_STATE) {
        client.socket.send(JSON.stringify(payload));
    }
}
function marketIdFromChannel(channel) {
    const match = /^market:(price|resolved):(.+)$/.exec(channel);
    return match?.[2] ?? null;
}
function eventTypeFromChannel(channel) {
    return channel.startsWith("market:resolved:") ? "resolved" : "price";
}
async function ensureRedisSubscription() {
    const subscriber = (0, redis_1.getSubscriberClient)();
    subscriber.on("pmessage", (_pattern, channel, message) => {
        const marketId = marketIdFromChannel(channel);
        if (!marketId)
            return;
        let parsed;
        try {
            parsed = JSON.parse(message);
        }
        catch {
            parsed = message;
        }
        for (const client of clients) {
            if (client.marketIds.has(marketId)) {
                sendJson(client, {
                    type: eventTypeFromChannel(channel),
                    marketId,
                    data: parsed,
                });
            }
        }
    });
    await subscriber.psubscribe("market:price:*", "market:resolved:*");
}
function handleClientMessage(client, message) {
    let parsed;
    try {
        parsed = JSON.parse(message.toString());
    }
    catch {
        sendJson(client, { type: "error", error: "Expected JSON message" });
        return;
    }
    const marketIds = parseMarketIds(parsed.marketIds ?? parsed.marketId);
    if (parsed.type === "subscribe") {
        for (const marketId of marketIds)
            client.marketIds.add(marketId);
    }
    else if (parsed.type === "unsubscribe") {
        for (const marketId of marketIds)
            client.marketIds.delete(marketId);
    }
    else {
        sendJson(client, { type: "error", error: "Unknown message type" });
        return;
    }
    sendJson(client, {
        type: "subscriptions",
        marketIds: [...client.marketIds],
    });
}
async function registerPriceWs(app) {
    await ensureRedisSubscription();
    app.get("/ws/prices", { websocket: true }, (connection, request) => {
        const url = new URL(request.url, "http://localhost");
        const initialMarketIds = parseMarketIds(url.searchParams.get("markets"));
        const client = {
            socket: connection.socket,
            marketIds: new Set(initialMarketIds),
        };
        clients.add(client);
        sendJson(client, {
            type: "subscriptions",
            marketIds: [...client.marketIds],
        });
        connection.socket.on("message", (message) => handleClientMessage(client, message));
        connection.socket.on("close", () => clients.delete(client));
        connection.socket.on("error", () => clients.delete(client));
    });
}
