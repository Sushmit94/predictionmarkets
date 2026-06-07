import { AppShell } from "@/components/AppShell";
import { MarketFilters } from "@/components/MarketFilters";
import { MarketGrid } from "@/components/MarketGrid";
import { StatusBadge } from "@/components/StatusBadge";
import { getMarkets } from "@/lib/api";
import { formatGdollar } from "@/lib/format";
import type { MarketSort, MarketStatus } from "@/lib/types";

const validStatuses = new Set(["active", "ended", "resolved", "all"]);
const validSorts = new Set(["newest", "ending", "volume"]);

export default async function Home({
    searchParams,
}: {
    searchParams: Promise<{ status?: string; sort?: string }>;
}) {
    const params = await searchParams;
    const status = (validStatuses.has(params.status ?? "") ? params.status : "active") as MarketStatus;
    const sort = (validSorts.has(params.sort ?? "") ? params.sort : "newest") as MarketSort;
    const { data: markets } = await getMarkets({ status, sort });
    const volume = markets.reduce((sum, market) => sum + Number(market.totalVolumeFormatted), 0);
    const activeMarkets = markets.filter((market) => !market.resolved).length;

    return (
        <AppShell>
            <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
                <section className="grid gap-5 lg:grid-cols-[1fr_360px] lg:items-end">
                    <div>
                        <StatusBadge tone="green">Celo Mainnet</StatusBadge>
                        <h1 className="mt-4 max-w-3xl text-4xl font-black leading-tight tracking-normal text-[#132019] sm:text-5xl">
                            Prediction markets settled in G$
                        </h1>
                        <p className="mt-4 max-w-2xl text-lg leading-8 text-[#40564a]">
                            Active markets, live LMSR prices, and GoodDollar-denominated positions.
                        </p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-lg border border-[#dce8dd] bg-white p-4">
                            <p className="text-sm font-semibold text-[#5a6b60]">Markets</p>
                            <p className="mt-2 text-3xl font-black">{activeMarkets}</p>
                        </div>
                        <div className="rounded-lg border border-[#dce8dd] bg-white p-4">
                            <p className="text-sm font-semibold text-[#5a6b60]">Volume</p>
                            <p className="mt-2 text-3xl font-black">{formatGdollar(volume)}</p>
                        </div>
                    </div>
                </section>

                <div className="mt-8">
                    <MarketFilters status={status} sort={sort} />
                </div>
                <div className="mt-5">
                    <MarketGrid markets={markets} />
                </div>
            </main>
        </AppShell>
    );
}
