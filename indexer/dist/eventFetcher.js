"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.marketIface = exports.factoryIface = exports.EVENT_TOPICS = void 0;
exports.fetchLogs = fetchLogs;
const ethers_1 = require("ethers");
const abi_1 = require("./abi");
// Pre-compute topic hashes so we don't recompute every poll
const factoryIface = new ethers_1.ethers.Interface(abi_1.FACTORY_ABI);
exports.factoryIface = factoryIface;
const marketIface = new ethers_1.ethers.Interface(abi_1.MARKET_ABI);
exports.marketIface = marketIface;
exports.EVENT_TOPICS = {
    MarketCreated: factoryIface.getEvent("MarketCreated").topicHash,
    SharesBought: marketIface.getEvent("SharesBought").topicHash,
    SharesSold: marketIface.getEvent("SharesSold").topicHash,
    MarketResolved: marketIface.getEvent("MarketResolved").topicHash,
    Redeemed: marketIface.getEvent("Redeemed").topicHash,
};
/**
 * Fetches all relevant event logs in [fromBlock, toBlock].
 *
 * Factory logs  → come from the single MarketFactory address.
 * Market logs   → come from any of the known proxy clone addresses.
 *
 * We split into two getLogs calls so we can use the correct address filter.
 * If there are no known markets yet, we skip the second call.
 */
async function fetchLogs(provider, factoryAddress, marketAddresses, fromBlock, toBlock) {
    // 1. Factory events (MarketCreated, OracleUpdated, etc.)
    const factoryLogs = await provider.getLogs({
        address: factoryAddress,
        topics: [
            [exports.EVENT_TOPICS.MarketCreated],
        ],
        fromBlock,
        toBlock,
    });
    // 2. Market proxy events (SharesBought, SharesSold, MarketResolved, Redeemed)
    let marketLogs = [];
    if (marketAddresses.length > 0) {
        marketLogs = await provider.getLogs({
            address: marketAddresses, // ethers accepts an array here
            topics: [
                [
                    exports.EVENT_TOPICS.SharesBought,
                    exports.EVENT_TOPICS.SharesSold,
                    exports.EVENT_TOPICS.MarketResolved,
                    exports.EVENT_TOPICS.Redeemed,
                ],
            ],
            fromBlock,
            toBlock,
        });
    }
    return { factoryLogs, marketLogs };
}
