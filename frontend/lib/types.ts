export type MarketStatus = "active" | "resolved" | "all";
export type MarketSort = "newest" | "ending" | "volume";
export type Outcome = 0 | 1;

export interface Market {
  id: string;
  address: string;
  question: string;
  category: string | null;
  externalId: string | null;
  endTime: string;
  createdAt: string;
  createdTxHash: string;
  yesShares: string;
  noShares: string;
  yesPrice: string;
  noPrice: string;
  yesProbability: number;
  noProbability: number;
  totalVolume: string;
  totalVolumeFormatted: string;
  totalCollateral: string;
  totalCollateralFormatted: string;
  resolved: boolean;
  winningOutcome: Outcome | null;
  resolvedAt: string | null;
  resolvedTxHash: string | null;
}

export interface Trade {
  id: number;
  marketId: string;
  marketAddress: string;
  trader: string;
  outcome: Outcome;
  outcomeLabel: "YES" | "NO";
  type: string;
  sharesAmount: string;
  sharesFormatted: string;
  collateralAmount: string;
  collateralFormatted: string;
  txHash: string;
  blockNumber: number;
  logIndex: number;
  timestamp: string;
}

export interface PricePoint {
  id: number;
  marketId: string;
  yesPrice: string;
  noPrice: string;
  yesProbability: number;
  noProbability: number;
  yesShares: string;
  noShares: string;
  blockNumber: number;
  timestamp: string;
}

export interface Position {
  marketId: string;
  marketAddress: string;
  question: string;
  category: string | null;
  resolved: boolean;
  winningOutcome: Outcome | null;
  yesPrice: string;
  noPrice: string;
  yesProbability: number;
  noProbability: number;
  yesShares: string;
  noShares: string;
  yesSharesFormatted: string;
  noSharesFormatted: string;
  buyCollateral: string;
  sellCollateral: string;
  buyCollateralFormatted: string;
  sellCollateralFormatted: string;
  tradeCount: number;
  lastTradeAt: string;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
