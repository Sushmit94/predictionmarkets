import type { Market, PricePoint, Trade } from "../db/schema";

const WAD_DECIMALS = 18;

export function parseLimit(raw: unknown, fallback: number, max: number): number {
  const value = Number(raw ?? fallback);
  if (!Number.isInteger(value) || value <= 0) return fallback;
  return Math.min(value, max);
}

export function parsePage(raw: unknown): number {
  const value = Number(raw ?? 1);
  if (!Number.isInteger(value) || value <= 0) return 1;
  return value;
}

export function isAddress(value: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(value);
}

export function toDecimal(wad: string | null | undefined, decimals = 4): string {
  const raw = BigInt(wad ?? "0");
  const scale = 10n ** BigInt(WAD_DECIMALS);
  const whole = raw / scale;
  const fraction = raw % scale;
  const padded = fraction.toString().padStart(WAD_DECIMALS, "0");
  const trimmed = padded.slice(0, decimals).replace(/0+$/, "");
  return trimmed ? `${whole}.${trimmed}` : whole.toString();
}

export function toProbability(wad: string | null | undefined): number {
  return Number(wad ?? "0") / 1e18;
}

export function serializeMarket(market: Market) {
  return {
    id: market.id,
    address: market.address,
    question: market.question,
    category: market.category,
    externalId: market.externalId,
    endTime: market.endTime.toISOString(),
    createdAt: market.createdAt.toISOString(),
    createdTxHash: market.createdTxHash,
    yesShares: market.yesShares,
    noShares: market.noShares,
    yesPrice: market.yesPrice ?? "0",
    noPrice: market.noPrice ?? "0",
    yesProbability: toProbability(market.yesPrice),
    noProbability: toProbability(market.noPrice),
    totalVolume: market.totalVolume,
    totalVolumeFormatted: toDecimal(market.totalVolume),
    totalCollateral: market.totalCollateral,
    totalCollateralFormatted: toDecimal(market.totalCollateral),
    resolved: market.resolved,
    winningOutcome: market.winningOutcome,
    resolvedAt: market.resolvedAt?.toISOString() ?? null,
    resolvedTxHash: market.resolvedTxHash,
  };
}

export function serializeTrade(trade: Trade) {
  return {
    id: trade.id,
    marketId: trade.marketId,
    marketAddress: trade.marketAddress,
    trader: trade.trader,
    outcome: trade.outcome,
    outcomeLabel: trade.outcome === 1 ? "YES" : "NO",
    type: trade.type,
    sharesAmount: trade.sharesAmount,
    sharesFormatted: toDecimal(trade.sharesAmount),
    collateralAmount: trade.collateralAmount,
    collateralFormatted: toDecimal(trade.collateralAmount),
    txHash: trade.txHash,
    blockNumber: trade.blockNumber,
    logIndex: trade.logIndex,
    timestamp: trade.timestamp.toISOString(),
  };
}

export function serializePricePoint(point: PricePoint) {
  return {
    id: point.id,
    marketId: point.marketId,
    yesPrice: point.yesPrice,
    noPrice: point.noPrice,
    yesProbability: toProbability(point.yesPrice),
    noProbability: toProbability(point.noPrice),
    yesShares: point.yesShares,
    noShares: point.noShares,
    blockNumber: point.blockNumber,
    timestamp: point.timestamp.toISOString(),
  };
}
