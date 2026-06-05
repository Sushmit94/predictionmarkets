import Link from "next/link";
import type { MarketSort, MarketStatus } from "@/lib/types";

const statuses: MarketStatus[] = ["active", "resolved", "all"];
const sorts: MarketSort[] = ["newest", "ending", "volume"];

export function MarketFilters({ status, sort }: { status: MarketStatus; sort: MarketSort }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-[#dce8dd] bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap gap-2">
        {statuses.map((item) => (
          <Link
            key={item}
            href={`/?status=${item}&sort=${sort}`}
            className={`rounded px-3 py-2 text-sm font-semibold capitalize ${
              status === item ? "bg-[#132019] text-white" : "bg-[#f1f5f1] text-[#40564a] hover:bg-[#e4ece5]"
            }`}
          >
            {item}
          </Link>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {sorts.map((item) => (
          <Link
            key={item}
            href={`/?status=${status}&sort=${item}`}
            className={`rounded px-3 py-2 text-sm font-semibold capitalize ${
              sort === item ? "bg-[#35d07f] text-[#092014]" : "bg-[#f1f5f1] text-[#40564a] hover:bg-[#e4ece5]"
            }`}
          >
            {item}
          </Link>
        ))}
      </div>
    </div>
  );
}
