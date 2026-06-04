import type { FastifyInstance } from "fastify";
import { getPositionsByAddress } from "../db/queries";
import { isAddress, toDecimal, toProbability } from "../lib/format";

export async function registerPositionRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Params: { address: string } }>("/positions/:address", async (request, reply) => {
    const address = request.params.address.toLowerCase();

    if (!isAddress(address)) {
      return reply.code(400).send({ error: "Invalid wallet address" });
    }

    const rows = await getPositionsByAddress(address);
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
        yesProbability: toProbability(row.yesPrice),
        noProbability: toProbability(row.noPrice),
        yesShares: row.yesShares,
        noShares: row.noShares,
        yesSharesFormatted: toDecimal(row.yesShares),
        noSharesFormatted: toDecimal(row.noShares),
        buyCollateral: row.buyCollateral,
        sellCollateral: row.sellCollateral,
        buyCollateralFormatted: toDecimal(row.buyCollateral),
        sellCollateralFormatted: toDecimal(row.sellCollateral),
        tradeCount: row.tradeCount,
        lastTradeAt: row.lastTradeAt.toISOString(),
      })),
    });
  });
}
