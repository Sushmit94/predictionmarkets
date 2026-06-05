import { formatDate, shortenAddress } from "@/lib/format";
import type { Trade } from "@/lib/types";

export function RecentTrades({ trades }: { trades: Trade[] }) {
  return (
    <section className="rounded-lg border border-[#dce8dd] bg-white p-5">
      <h2 className="text-xl font-semibold">Recent Trades</h2>
      <div className="mt-4 divide-y divide-[#edf2ee]">
        {trades.length === 0 ? (
          <p className="py-8 text-sm text-[#5a6b60]">No trades indexed yet.</p>
        ) : (
          trades.map((trade) => (
            <div key={`${trade.txHash}-${trade.logIndex}`} className="grid gap-3 py-4 sm:grid-cols-[1fr_auto_auto] sm:items-center">
              <div>
                <p className="font-semibold">
                  {trade.type.toUpperCase()} {trade.outcomeLabel}
                </p>
                <p className="text-sm text-[#5a6b60]">
                  {shortenAddress(trade.trader)} at {formatDate(trade.timestamp)}
                </p>
              </div>
              <p className="text-sm font-semibold">{trade.sharesFormatted} shares</p>
              <p className="text-sm font-semibold">G${trade.collateralFormatted}</p>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
