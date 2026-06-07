export interface TradePreview {
  expectedShares: number;
  averagePrice: number;
  priceAfter: number;
  priceImpact: number;
}

const DEFAULT_LIQUIDITY = 10_000;

function wadToNumber(valueRaw: string) {
  return Number(BigInt(valueRaw || "0")) / 1e18;
}

function priceFor(yesShares: number, noShares: number, outcome: "YES" | "NO", b = DEFAULT_LIQUIDITY) {
  const yesExp = Math.exp(yesShares / b);
  const noExp = Math.exp(noShares / b);
  const yesPrice = yesExp / (yesExp + noExp);
  return outcome === "YES" ? yesPrice : 1 - yesPrice;
}

function cost(yesShares: number, noShares: number, b = DEFAULT_LIQUIDITY) {
  const yesExp = Math.exp(yesShares / b);
  const noExp = Math.exp(noShares / b);
  return b * Math.log(yesExp + noExp);
}

function buyCost(yesShares: number, noShares: number, shares: number, outcome: "YES" | "NO", b = DEFAULT_LIQUIDITY) {
  const nextYesShares = outcome === "YES" ? yesShares + shares : yesShares;
  const nextNoShares = outcome === "NO" ? noShares + shares : noShares;
  return cost(nextYesShares, nextNoShares, b) - cost(yesShares, noShares, b);
}

function sharesForBudget(
  yesShares: number,
  noShares: number,
  collateral: number,
  outcome: "YES" | "NO",
  b = DEFAULT_LIQUIDITY,
) {
  if (collateral <= 0) return 0;

  let low = 0;
  let high = Math.max(collateral * 2, 1);

  while (buyCost(yesShares, noShares, high, outcome, b) < collateral) {
    high *= 2;
  }

  for (let i = 0; i < 64; i += 1) {
    const mid = (low + high) / 2;
    if (buyCost(yesShares, noShares, mid, outcome, b) <= collateral) {
      low = mid;
    } else {
      high = mid;
    }
  }

  return low;
}

export function previewBuy(
  yesSharesRaw: string,
  noSharesRaw: string,
  collateral: number,
  outcome: "YES" | "NO",
  bRaw?: string,
): TradePreview {
  const yesShares = wadToNumber(yesSharesRaw);
  const noShares = wadToNumber(noSharesRaw);
  const b = bRaw ? wadToNumber(bRaw) : DEFAULT_LIQUIDITY;
  const before = priceFor(yesShares, noShares, outcome, b);
  const expectedShares = sharesForBudget(yesShares, noShares, collateral, outcome, b);
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
