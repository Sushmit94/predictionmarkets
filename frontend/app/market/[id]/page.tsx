import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { LivePriceIndicator } from "@/components/LivePriceIndicator";
import { PriceChart } from "@/components/PriceChart";
import { RecentTrades } from "@/components/RecentTrades";
import { StatusBadge } from "@/components/StatusBadge";
import { TradePanel } from "@/components/TradePanel";
import { getMarket, getPriceHistory } from "@/lib/api";
import { formatDate, formatGdollar, formatPercent, shortenAddress, timeUntil } from "@/lib/format";

export default async function MarketDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const marketResponse = await getMarket(id);
  if (!marketResponse) notFound();

  const history = await getPriceHistory(id);
  const market = marketResponse.data;

  return (
    <AppShell>
      <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Link href="/" className="text-sm font-semibold text-[#2b9d62] hover:text-[#167344]">
          Back to markets
        </Link>

        <section className="mt-5 grid gap-6 lg:grid-cols-[1fr_360px]">
          <div>
            {(() => {
              const isEnded = !market.resolved && new Date(market.endTime).getTime() <= Date.now();
              const statusLabel = market.resolved ? "Resolved" : isEnded ? "Ended" : "Active";
              const statusTone = market.resolved ? "neutral" : isEnded ? "amber" : "green";
              return (
                <div className="flex flex-wrap items-center gap-3">
                  <StatusBadge tone={statusTone}>{statusLabel}</StatusBadge>
                  <StatusBadge>{market.category ?? "General"}</StatusBadge>
                  <LivePriceIndicator marketId={market.id} />
                </div>
              );
            })()}
            <h1 className="mt-4 max-w-4xl text-4xl font-black leading-tight tracking-normal text-[#132019]">{market.question}</h1>

            <div className="mt-6 grid gap-3 sm:grid-cols-4">
              <div className="rounded-lg border border-[#cdebd8] bg-[#f2fff6] p-4">
                <p className="text-sm font-semibold text-[#407551]">YES</p>
                <p className="mt-2 text-3xl font-black">{formatPercent(market.yesProbability)}</p>
              </div>
              <div className="rounded-lg border border-[#d9e4df] bg-white p-4">
                <p className="text-sm font-semibold text-[#657369]">NO</p>
                <p className="mt-2 text-3xl font-black">{formatPercent(market.noProbability)}</p>
              </div>
              <div className="rounded-lg border border-[#dce8dd] bg-white p-4">
                <p className="text-sm font-semibold text-[#657369]">Volume</p>
                <p className="mt-2 text-3xl font-black">{formatGdollar(market.totalVolumeFormatted)}</p>
              </div>
              <div className="rounded-lg border border-[#dce8dd] bg-white p-4">
                <p className="text-sm font-semibold text-[#657369]">Ends</p>
                <p className="mt-2 text-xl font-black">{timeUntil(market.endTime)}</p>
              </div>
            </div>

            <div className="mt-6 grid gap-2 text-sm text-[#5a6b60] sm:grid-cols-3">
              <p>Market {market.id}</p>
              <p>Contract {shortenAddress(market.address)}</p>
              <p>End {formatDate(market.endTime)}</p>
            </div>
          </div>

          <TradePanel market={market} />
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="space-y-6">
            <PriceChart points={history.data} />
            <RecentTrades trades={marketResponse.recentTrades} />
          </div>
          <section className="h-fit rounded-lg border border-[#dce8dd] bg-white p-5">
            <h2 className="text-xl font-semibold">Settlement</h2>
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-[#5a6b60]">Collateral</span>
                <span className="font-semibold">{formatGdollar(market.totalCollateralFormatted)}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-[#5a6b60]">Created</span>
                <span className="font-semibold">{formatDate(market.createdAt)}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-[#5a6b60]">Winner</span>
                <span className="font-semibold">
                  {market.winningOutcome === null ? "Pending" : market.winningOutcome === 1 ? "YES" : "NO"}
                </span>
              </div>
            </div>
          </section>
        </div>
      </main>
    </AppShell>
  );
}
