export interface TradePreview {
  expectedShares: number;
  averagePrice: number;
  priceAfter: number;
  priceImpact: number;
}

const DEFAULT_LIQUIDITY = 10_000;

function priceFor(yesShares: number, noShares: number, outcome: "YES" | "NO", b = DEFAULT_LIQUIDITY) {
  const yesExp = Math.exp(yesShares / b);
  const noExp = Math.exp(noShares / b);
  const yesPrice = yesExp / (yesExp + noExp);
  return outcome === "YES" ? yesPrice : 1 - yesPrice;
}

export function previewBuy(
  yesSharesRaw: string,
  noSharesRaw: string,
  collateral: number,
  outcome: "YES" | "NO",
  b = DEFAULT_LIQUIDITY
): TradePreview {
  const yesShares = Number(BigInt(yesSharesRaw || "0") / 10n ** 18n);
  const noShares = Number(BigInt(noSharesRaw || "0") / 10n ** 18n);
  const before = priceFor(yesShares, noShares, outcome, b);
  const expectedShares = collateral / Math.max(before, 0.01);
  const afterYes = outcome === "YES" ? yesShares + expectedShares : yesShares;
  const afterNo = outcome === "NO" ? noShares + expectedShares : noShares;
  const after = priceFor(afterYes, afterNo, outcome, b);

  return {
    expectedShares,
    averagePrice: collateral / Math.max(expectedShares, 0.01),
    priceAfter: after,
    priceImpact: after - before,
  };
}
