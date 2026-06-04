// ─── MarketFactory ABI (events only) ─────────────────────────────────────────
export const FACTORY_ABI = [
  // MarketCreated(uint256 indexed marketId, address indexed marketAddress,
  //               string question, string category, string externalId, uint256 endTime)
  "event MarketCreated(uint256 indexed marketId, address indexed marketAddress, string question, string category, string externalId, uint256 endTime)",
  "event OracleUpdated(address newOracle)",
  "event LiquidityParamUpdated(uint256 newParam)",
] as const;

// ─── PredictionMarket ABI (events only) ──────────────────────────────────────
export const MARKET_ABI = [
  // SharesBought(address indexed trader, uint8 indexed outcome,
  //              uint256 sharesAmount, uint256 collateralPaid)
  "event SharesBought(address indexed trader, uint8 indexed outcome, uint256 sharesAmount, uint256 collateralPaid)",

  // SharesSold(address indexed trader, uint8 indexed outcome,
  //            uint256 sharesAmount, uint256 collateralReceived)
  "event SharesSold(address indexed trader, uint8 indexed outcome, uint256 sharesAmount, uint256 collateralReceived)",

  // MarketResolved(uint8 winningOutcome, uint256 timestamp)
  "event MarketResolved(uint8 winningOutcome, uint256 timestamp)",

  // Redeemed(address indexed trader, uint256 collateralAmount)
  "event Redeemed(address indexed trader, uint256 collateralAmount)",
] as const;