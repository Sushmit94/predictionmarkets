"use client";

import { useMemo, useState } from "react";
import { formatGdollar, formatProbability } from "@/lib/format";
import { previewBuy } from "@/lib/lmsr";
import type { Market } from "@/lib/types";

export function TradePanel({ market }: { market: Market }) {
  const [outcome, setOutcome] = useState<"YES" | "NO">("YES");
  const [amount, setAmount] = useState("100");
  const numericAmount = Number(amount);
  const preview = useMemo(() => {
    return previewBuy(market.yesShares, market.noShares, Number.isFinite(numericAmount) ? numericAmount : 0, outcome);
  }, [amount, market.noShares, market.yesShares, numericAmount, outcome]);

  return (
    <aside className="rounded-lg border border-[#dce8dd] bg-white p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">Trade</h2>
        <span className="rounded bg-[#e9fff1] px-2 py-1 text-xs font-bold text-[#116636]">G$</span>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2 rounded bg-[#f0f4ef] p-1">
        {(["YES", "NO"] as const).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setOutcome(item)}
            className={`h-11 rounded text-sm font-bold ${
              outcome === item ? "bg-white text-[#132019] shadow-sm" : "text-[#5a6b60] hover:bg-[#e6eee7]"
            }`}
          >
            {item}
          </button>
        ))}
      </div>

      <label className="mt-5 block text-sm font-semibold text-[#40564a]" htmlFor="trade-amount">
        Amount
      </label>
      <div className="mt-2 flex h-12 items-center rounded border border-[#cfded2] bg-white px-3 focus-within:border-[#35d07f]">
        <span className="font-semibold text-[#5a6b60]">G$</span>
        <input
          id="trade-amount"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          inputMode="decimal"
          className="min-w-0 flex-1 bg-transparent px-2 text-lg font-semibold outline-none"
        />
      </div>

      <div className="mt-5 space-y-3 rounded border border-[#edf2ee] bg-[#fbfdfb] p-4 text-sm">
        <div className="flex justify-between gap-3">
          <span className="text-[#5a6b60]">Shares</span>
          <span className="font-semibold">{preview.expectedShares.toFixed(2)}</span>
        </div>
        <div className="flex justify-between gap-3">
          <span className="text-[#5a6b60]">Average price</span>
          <span className="font-semibold">{formatProbability(preview.averagePrice)}</span>
        </div>
        <div className="flex justify-between gap-3">
          <span className="text-[#5a6b60]">After trade</span>
          <span className="font-semibold">{formatProbability(preview.priceAfter)}</span>
        </div>
        <div className="flex justify-between gap-3">
          <span className="text-[#5a6b60]">Impact</span>
          <span className="font-semibold">{formatProbability(Math.abs(preview.priceImpact))}</span>
        </div>
      </div>

      <button
        type="button"
        className="mt-5 h-12 w-full rounded bg-[#132019] px-4 text-sm font-bold text-white hover:bg-[#23362a]"
      >
        Connect Wallet
      </button>
      <div className="mt-5 flex justify-between border-t border-[#edf2ee] pt-4 text-sm">
        <span className="text-[#5a6b60]">Liquidity</span>
        <span className="font-semibold">{formatGdollar(market.totalCollateralFormatted)}</span>
      </div>
    </aside>
  );
}
