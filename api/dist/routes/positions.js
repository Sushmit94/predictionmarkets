"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerPositionRoutes = registerPositionRoutes;
const queries_1 = require("../db/queries");
const format_1 = require("../lib/format");
async function registerPositionRoutes(app) {
    app.get("/positions/:address", async (request, reply) => {
        const address = request.params.address.toLowerCase();
        if (!(0, format_1.isAddress)(address)) {
            return reply.code(400).send({ error: "Invalid wallet address" });
        }
        const rows = await (0, queries_1.getPositionsByAddress)(address);
        return reply.send({
            address,
            data: rows.map((row) => ({
                marketId: row.marketId,
                marketAddress: row.marketAddress,
                question: row.question,
                category: row.category,
                resolved: row.resolved,
                winningOutcome: row.winningOutcome,
                yesPrice: row.yesPrice,
                noPrice: row.noPrice,
                yesProbability: (0, format_1.toProbability)(row.yesPrice),
                noProbability: (0, format_1.toProbability)(row.noPrice),
                yesShares: row.yesShares,
                noShares: row.noShares,
                yesSharesFormatted: (0, format_1.toDecimal)(row.yesShares),
                noSharesFormatted: (0, format_1.toDecimal)(row.noShares),
                buyCollateral: row.buyCollateral,
                sellCollateral: row.sellCollateral,
                buyCollateralFormatted: (0, format_1.toDecimal)(row.buyCollateral),
                sellCollateralFormatted: (0, format_1.toDecimal)(row.sellCollateral),
                tradeCount: row.tradeCount,
                lastTradeAt: row.lastTradeAt.toISOString(),
            })),
        });
    });
}
