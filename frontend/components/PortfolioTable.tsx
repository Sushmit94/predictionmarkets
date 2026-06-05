import Link from "next/link";
import { formatDate, formatGdollar, formatNumber, formatPercent } from "@/lib/format";
import type { Position } from "@/lib/types";

export function PortfolioTable({ positions }: { positions: Position[] }) {
  if (positions.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-[#c9d8cd] bg-white p-10 text-center">
        <p className="text-lg font-semibold">No indexed positions for this wallet.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-[#dce8dd] bg-white">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-[#f0f4ef] text-[#40564a]">
            <tr>
              <th className="px-4 py-3 font-semibold">Market</th>
              <th className="px-4 py-3 font-semibold">YES</th>
              <th className="px-4 py-3 font-semibold">NO</th>
              <th className="px-4 py-3 font-semibold">Exposure</th>
              <th className="px-4 py-3 font-semibold">Last trade</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#edf2ee]">
            {positions.map((position) => (
              <tr key={position.marketId}>
                <td className="px-4 py-4">
                  <Link href={`/market/${position.marketId}`} className="font-semibold hover:text-[#18874c]">
                    {position.question}
                  </Link>
                  <p className="mt-1 text-xs text-[#657369]">{position.category ?? "General"}</p>
                </td>
                <td className="px-4 py-4">
                  <p className="font-semibold">{formatNumber(position.yesSharesFormatted)}</p>
                  <p className="text-xs text-[#657369]">{formatPercent(position.yesProbability)}</p>
                </td>
                <td className="px-4 py-4">
                  <p className="font-semibold">{formatNumber(position.noSharesFormatted)}</p>
                  <p className="text-xs text-[#657369]">{formatPercent(position.noProbability)}</p>
                </td>
                <td className="px-4 py-4 font-semibold">{formatGdollar(position.buyCollateralFormatted)}</td>
                <td className="px-4 py-4 text-[#5a6b60]">{formatDate(position.lastTradeAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
