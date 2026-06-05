import type { Market } from "@/lib/types";
import { MarketCard } from "./MarketCard";

export function MarketGrid({ markets }: { markets: Market[] }) {
  if (markets.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-[#c9d8cd] bg-white p-10 text-center">
        <p className="text-lg font-semibold">No markets match this view.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {markets.map((market) => (
        <MarketCard key={market.id} market={market} />
      ))}
    </div>
  );
}
