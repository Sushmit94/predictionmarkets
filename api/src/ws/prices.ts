import type { FastifyInstance, FastifyRequest } from "fastify";
import { getSubscriberClient } from "../lib/redis";

type ClientSocket = {
  send(payload: string): void;
  close(): void;
  readyState: number;
  on(event: "message", listener: (message: Buffer | string) => void): void;
  on(event: "close" | "error", listener: () => void): void;
};

interface ClientState {
  socket: ClientSocket;
  marketIds: Set<string>;
}

interface PriceMessage {
  type: "subscribe" | "unsubscribe";
  marketIds?: string[];
  marketId?: string;
}

const OPEN_STATE = 1;
const clients = new Set<ClientState>();

function parseMarketIds(input: unknown): string[] {
  if (Array.isArray(input)) {
    return input.map(String).filter(Boolean);
  }
  if (typeof input === "string") {
    return input.split(",").map((id) => id.trim()).filter(Boolean);
  }
  return [];
}

function sendJson(client: ClientState, payload: unknown): void {
  if (client.socket.readyState === OPEN_STATE) {
    client.socket.send(JSON.stringify(payload));
  }
}

function marketIdFromChannel(channel: string): string | null {
  const match = /^market:(price|resolved):(.+)$/.exec(channel);
  return match?.[2] ?? null;
}

function eventTypeFromChannel(channel: string): "price" | "resolved" {
  return channel.startsWith("market:resolved:") ? "resolved" : "price";
}

async function ensureRedisSubscription(): Promise<void> {
  const subscriber = getSubscriberClient();

  subscriber.on("pmessage", (_pattern, channel, message) => {
    const marketId = marketIdFromChannel(channel);
    if (!marketId) return;

    let parsed: unknown;
    try {
      parsed = JSON.parse(message);
    } catch {
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

function handleClientMessage(client: ClientState, message: Buffer | string): void {
  let parsed: PriceMessage;

  try {
    parsed = JSON.parse(message.toString()) as PriceMessage;
  } catch {
    sendJson(client, { type: "error", error: "Expected JSON message" });
    return;
  }

  const marketIds = parseMarketIds(parsed.marketIds ?? parsed.marketId);
  if (parsed.type === "subscribe") {
    for (const marketId of marketIds) client.marketIds.add(marketId);
  } else if (parsed.type === "unsubscribe") {
    for (const marketId of marketIds) client.marketIds.delete(marketId);
  } else {
    sendJson(client, { type: "error", error: "Unknown message type" });
    return;
  }

  sendJson(client, {
    type: "subscriptions",
    marketIds: [...client.marketIds],
  });
}

export async function registerPriceWs(app: FastifyInstance): Promise<void> {
  await ensureRedisSubscription();

  app.get(
    "/ws/prices",
    { websocket: true },
    (connection: { socket: ClientSocket }, request: FastifyRequest) => {
      const url = new URL(request.url, "http://localhost");
      const initialMarketIds = parseMarketIds(url.searchParams.get("markets"));
      const client: ClientState = {
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
    }
  );
}
