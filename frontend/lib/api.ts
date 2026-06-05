import { demoMarkets, demoPositions, demoPriceHistory, demoTrades } from "./demo-data";
import type { Market, MarketSort, MarketStatus, Pagination, Position, PricePoint, Trade } from "./types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface MarketsResponse {
  data: Market[];
  pagination: Pagination;
}

interface MarketResponse {
  data: Market;
  recentTrades: Trade[];
}

interface PriceHistoryResponse {
  data: PricePoint[];
  market: Market;
}

interface PositionsResponse {
  address: string;
  data: Position[];
}

async function requestJson<T>(path: string): Promise<T | null> {
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      next: { revalidate: 10 },
    });

    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export async function getMarkets(options: {
  status?: MarketStatus;
  sort?: MarketSort;
  category?: string;
  limit?: number;
  page?: number;
} = {}): Promise<MarketsResponse> {
  const params = new URLSearchParams({
    status: options.status ?? "active",
    sort: options.sort ?? "newest",
    limit: String(options.limit ?? 24),
    page: String(options.page ?? 1),
  });

  if (options.category) params.set("category", options.category);

  const response = await requestJson<MarketsResponse>(`/markets?${params}`);
  if (response) return response;

  return {
    data: demoMarkets,
    pagination: {
      page: 1,
      limit: demoMarkets.length,
      total: demoMarkets.length,
      totalPages: 1,
    },
  };
}

export async function getMarket(id: string): Promise<MarketResponse | null> {
  const response = await requestJson<MarketResponse>(`/markets/${id}`);
  if (response) return response;

  const market = demoMarkets.find((item) => item.id === id) ?? demoMarkets[0];
  return {
    data: market,
    recentTrades: demoTrades.map((trade) => ({ ...trade, marketId: market.id, marketAddress: market.address })),
  };
}

export async function getPriceHistory(id: string): Promise<PriceHistoryResponse> {
  const response = await requestJson<PriceHistoryResponse>(`/markets/${id}/prices?limit=120`);
  if (response) return response;

  const market = demoMarkets.find((item) => item.id === id) ?? demoMarkets[0];
  return {
    data: demoPriceHistory.map((point) => ({ ...point, marketId: market.id })),
    market,
  };
}

export async function getPositions(address: string): Promise<PositionsResponse> {
  const response = await requestJson<PositionsResponse>(`/positions/${address}`);
  if (response) return response;

  return {
    address,
    data: demoPositions,
  };
}

export function getWsUrl(marketIds: string[] = []): string {
  const wsBase = (process.env.NEXT_PUBLIC_WS_URL ?? API_BASE_URL.replace(/^http/, "ws")).replace(/\/$/, "");
  const params = marketIds.length ? `?markets=${encodeURIComponent(marketIds.join(","))}` : "";
  return `${wsBase}/ws/prices${params}`;
}
