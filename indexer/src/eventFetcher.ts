import { ethers, Log } from "ethers";
import { FACTORY_ABI, MARKET_ABI } from "./abi";

// Pre-compute topic hashes so we don't recompute every poll
const factoryIface = new ethers.Interface(FACTORY_ABI);
const marketIface  = new ethers.Interface(MARKET_ABI);

export const EVENT_TOPICS = {
  MarketCreated:   factoryIface.getEvent("MarketCreated")!.topicHash,
  SharesBought:    marketIface.getEvent("SharesBought")!.topicHash,
  SharesSold:      marketIface.getEvent("SharesSold")!.topicHash,
  MarketResolved:  marketIface.getEvent("MarketResolved")!.topicHash,
  Redeemed:        marketIface.getEvent("Redeemed")!.topicHash,
};

export { factoryIface, marketIface };

export interface FetchedLogs {
  factoryLogs: Log[];
  marketLogs:  Log[];
}

/**
 * Fetches all relevant event logs in [fromBlock, toBlock].
 *
 * Factory logs  → come from the single MarketFactory address.
 * Market logs   → come from any of the known proxy clone addresses.
 *
 * We split into two getLogs calls so we can use the correct address filter.
 * If there are no known markets yet, we skip the second call.
 */
export async function fetchLogs(
  provider: ethers.JsonRpcProvider,
  factoryAddress: string,
  marketAddresses: string[],
  fromBlock: number,
  toBlock: number
): Promise<FetchedLogs> {
  // 1. Factory events (MarketCreated, OracleUpdated, etc.)
  const factoryLogs = await provider.getLogs({
    address: factoryAddress,
    topics: [
      [EVENT_TOPICS.MarketCreated],
    ],
    fromBlock,
    toBlock,
  });

  // 2. Market proxy events (SharesBought, SharesSold, MarketResolved, Redeemed)
  let marketLogs: Log[] = [];
  if (marketAddresses.length > 0) {
    marketLogs = await provider.getLogs({
      address: marketAddresses,   // ethers accepts an array here
      topics: [
        [
          EVENT_TOPICS.SharesBought,
          EVENT_TOPICS.SharesSold,
          EVENT_TOPICS.MarketResolved,
          EVENT_TOPICS.Redeemed,
        ],
      ],
      fromBlock,
      toBlock,
    });
  }

  return { factoryLogs, marketLogs };
}