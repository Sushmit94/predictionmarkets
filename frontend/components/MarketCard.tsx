import Link from "next/link";
import { formatGdollar, formatPercent, timeUntil } from "@/lib/format";
import type { Market } from "@/lib/types";
import { StatusBadge } from "./StatusBadge";

export function MarketCard({ market }: { market: Market }) {
  const yesPercent = Math.round(market.yesProbability * 100);
  const noPercent = 100 - yesPercent;
  const isEnded = !market.resolved && new Date(market.endTime).getTime() <= Date.now();
  const statusLabel = market.resolved ? "Resolved" : isEnded ? "Ended" : "Active";
  const statusTone = market.resolved ? "neutral" : isEnded ? "amber" : "green";

  return (
    <Link
      href={`/market/${market.id}`}
      className="group grid min-h-64 rounded-lg border border-[#dce8dd] bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-[#35d07f] hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <StatusBadge tone={statusTone}>{statusLabel}</StatusBadge>
        <span className="text-sm font-medium text-[#5a6b60]">{timeUntil(market.endTime)}</span>
      </div>

      <div className="mt-5">
        <p className="text-sm font-semibold uppercase text-[#2b9d62]">{market.category ?? "General"}</p>
        <h2 className="mt-2 text-xl font-semibold leading-tight text-[#132019]">{market.question}</h2>
      </div>

      <div className="mt-6 space-y-3 self-end">
        <div className="h-3 overflow-hidden rounded bg-[#f0f4ef]">
          <div className="h-full bg-[#35d07f]" style={{ width: `${yesPercent}%` }} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded border border-[#cdebd8] bg-[#f2fff6] p-3">
            <p className="text-xs font-semibold text-[#407551]">YES</p>
            <p className="mt-1 text-2xl font-bold">{formatPercent(market.yesProbability)}</p>
          </div>
          <div className="rounded border border-[#d9e4df] bg-[#fbfcfb] p-3">
            <p className="text-xs font-semibold text-[#657369]">NO</p>
            <p className="mt-1 text-2xl font-bold">{noPercent}%</p>
          </div>
        </div>
        <div className="flex items-center justify-between text-sm text-[#5a6b60]">
          <span>Volume</span>
          <span className="font-semibold text-[#132019]">{formatGdollar(market.totalVolumeFormatted)}</span>
        </div>
      </div>
    </Link>
  );
}
