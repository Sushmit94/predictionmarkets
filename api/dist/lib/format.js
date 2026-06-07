"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseLimit = parseLimit;
exports.parsePage = parsePage;
exports.isAddress = isAddress;
exports.toDecimal = toDecimal;
exports.toProbability = toProbability;
exports.serializeMarket = serializeMarket;
exports.serializeTrade = serializeTrade;
exports.serializePricePoint = serializePricePoint;
const WAD_DECIMALS = 18;
function parseLimit(raw, fallback, max) {
    const value = Number(raw ?? fallback);
    if (!Number.isInteger(value) || value <= 0)
        return fallback;
    return Math.min(value, max);
}
function parsePage(raw) {
    const value = Number(raw ?? 1);
    if (!Number.isInteger(value) || value <= 0)
        return 1;
    return value;
}
function isAddress(value) {
    return /^0x[a-fA-F0-9]{40}$/.test(value);
}
function toDecimal(wad, decimals = 4) {
    const raw = BigInt(wad ?? "0");
    const scale = 10n ** BigInt(WAD_DECIMALS);
    const whole = raw / scale;
    const fraction = raw % scale;
    const padded = fraction.toString().padStart(WAD_DECIMALS, "0");
    const trimmed = padded.slice(0, decimals).replace(/0+$/, "");
    return trimmed ? `${whole}.${trimmed}` : whole.toString();
}
function toProbability(wad) {
    return Number(wad ?? "0") / 1e18;
}
function serializeMarket(market) {
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
function serializeTrade(trade) {
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
function serializePricePoint(point) {
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
