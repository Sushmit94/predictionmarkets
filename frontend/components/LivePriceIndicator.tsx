"use client";

import { useMemo } from "react";
import { usePriceSocket } from "@/hooks/usePriceSocket";

export function LivePriceIndicator({ marketId }: { marketId: string }) {
  const marketIds = useMemo(() => [marketId], [marketId]);
  const { lastMessage, status } = usePriceSocket(marketIds);
  const label = status === "live" ? "Live" : status === "connecting" ? "Syncing" : "Offline";
  const tone = status === "live" ? "bg-[#35d07f]" : status === "connecting" ? "bg-[#d8c642]" : "bg-[#d96c55]";

  return (
    <div className="flex items-center gap-2 text-sm font-semibold text-[#40564a]">
      <span className={`size-2.5 rounded-full ${tone}`} />
      <span>{label}</span>
      {lastMessage?.type === "price" ? <span className="text-[#2b9d62]">price update</span> : null}
    </div>
  );
}
