"use client";

import { useMemo, useState } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseEther, formatEther } from "viem";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { formatGdollar, formatProbability } from "@/lib/format";
import { previewBuy } from "@/lib/lmsr";
import { CONTRACTS, ERC20_ABI, PREDICTION_MARKET_ABI } from "@/lib/wagmi";
import { useIdentity } from "@/hooks/useIdentity";
import { useGDollarBalance, useGDollarAllowance } from "@/hooks/useGDollar";
import type { Market } from "@/lib/types";

type TradeMode = "buy" | "sell" | "redeem";

export function TradePanel({ market }: { market: Market }) {
  const { address, isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();

  const [mode, setMode] = useState<TradeMode>("buy");
  const [outcome, setOutcome] = useState<"YES" | "NO">("YES");
  const [amount, setAmount] = useState("100");

  const numericAmount = Number(amount);
  const amountWei = parseEther(Number.isFinite(numericAmount) && numericAmount > 0 ? amount : "0");
  const marketAddress = market.address as `0x${string}`;

  // On-chain reads
  const { isWhitelisted, isLoading: identityLoading } = useIdentity(address);
  const { balance, refetchBalance } = useGDollarBalance(address);
  const { allowance, refetchAllowance } = useGDollarAllowance(address, marketAddress);

  // Write hooks
  const { writeContract: writeApprove, data: approveTxHash, isPending: approving } = useWriteContract();
  const { writeContract: writeTrade,   data: tradeTxHash,   isPending: trading }   = useWriteContract();

  const { isLoading: waitingApprove, isSuccess: approveConfirmed } = useWaitForTransactionReceipt({
    hash: approveTxHash,
    query: { enabled: !!approveTxHash },
  });
  const { isLoading: waitingTrade, isSuccess: tradeConfirmed } = useWaitForTransactionReceipt({
    hash: tradeTxHash,
    query: { enabled: !!tradeTxHash },
  });

  // Refresh after confirmation
  if (approveConfirmed) { refetchAllowance(); }
  if (tradeConfirmed)   { refetchBalance();   }

  const preview = useMemo(() => {
    return previewBuy(
      market.yesShares,
      market.noShares,
      Number.isFinite(numericAmount) ? numericAmount : 0,
      outcome,
    );
  }, [amount, market.noShares, market.yesShares, numericAmount, outcome]);

  const needsApproval = mode === "buy" && allowance < amountWei;
  const hasEnoughBalance = balance >= amountWei;
  const outcomeIndex = outcome === "YES" ? 1 : 0;

  // ─── Derived button state ─────────────────────────────────────────────────
  function getButtonState(): { label: string; disabled: boolean; action: () => void } {
    if (!isConnected) {
      return { label: "Connect Wallet", disabled: false, action: () => openConnectModal?.() };
    }

    if (identityLoading) {
      return { label: "Checking identity…", disabled: true, action: () => {} };
    }

    if (!isWhitelisted) {
      return {
        label: "Get GoodDollar Verified",
        disabled: false,
        action: () => window.open("https://gooddapp.org/#/face-verification", "_blank"),
      };
    }

    if (approving || waitingApprove) {
      return { label: "Approving G$…", disabled: true, action: () => {} };
    }

    if (trading || waitingTrade) {
      return { label: "Confirming…", disabled: true, action: () => {} };
    }

    if (mode === "redeem") {
      if (!market.resolved) return { label: "Market not resolved", disabled: true, action: () => {} };
      return {
        label: "Redeem winnings",
        disabled: false,
        action: () => writeTrade({ address: marketAddress, abi: PREDICTION_MARKET_ABI, functionName: "redeem", args: [] }),
      };
    }

    if (mode === "buy") {
      if (!hasEnoughBalance) return { label: "Insufficient G$ balance", disabled: true, action: () => {} };
      if (numericAmount <= 0)  return { label: "Enter an amount", disabled: true, action: () => {} };

      if (needsApproval) {
        return {
          label: `Approve G$${numericAmount}`,
          disabled: false,
          action: () => writeApprove({
            address: CONTRACTS.G_DOLLAR,
            abi: ERC20_ABI,
            functionName: "approve",
            args: [marketAddress, amountWei],
          }),
        };
      }

      return {
        label: `Buy ${outcome}`,
        disabled: false,
        action: () => writeTrade({
          address: marketAddress,
          abi: PREDICTION_MARKET_ABI,
          functionName: "buy",
          args: [
            outcomeIndex,                              // outcome (0=NO, 1=YES)
            parseEther((preview.expectedShares * 0.95).toFixed(6)), // minShares (5% slippage)
            amountWei,                                 // maxCost
          ],
        }),
      };
    }

    // sell mode
    if (numericAmount <= 0) return { label: "Enter shares to sell", disabled: true, action: () => {} };
    return {
      label: `Sell ${outcome}`,
      disabled: false,
      action: () => writeTrade({
        address: marketAddress,
        abi: PREDICTION_MARKET_ABI,
        functionName: "sell",
        args: [
          outcomeIndex,
          amountWei,                                   // shares
          parseEther((numericAmount * 0.95).toFixed(6)), // minReturn (5% slippage)
        ],
      }),
    };
  }

  const btn = getButtonState();
  const balanceFormatted = isConnected ? `G$${Number(formatEther(balance)).toFixed(2)}` : null;

  return (
    <aside className="rounded-lg border border-[#dce8dd] bg-white p-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">Trade</h2>
        <span className="rounded bg-[#e9fff1] px-2 py-1 text-xs font-bold text-[#116636]">G$</span>
      </div>

      {/* Mode tabs: Buy / Sell / Redeem */}
      <div className="mt-4 grid grid-cols-3 gap-1 rounded bg-[#f0f4ef] p-1">
        {(["buy", "sell", "redeem"] as TradeMode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`h-9 rounded text-xs font-bold capitalize ${
              mode === m ? "bg-white text-[#132019] shadow-sm" : "text-[#5a6b60] hover:bg-[#e6eee7]"
            }`}
          >
            {m}
          </button>
        ))}
      </div>

      {/* YES / NO tabs (not shown for redeem) */}
      {mode !== "redeem" && (
        <div className="mt-4 grid grid-cols-2 gap-2 rounded bg-[#f0f4ef] p-1">
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
      )}

      {/* Amount input */}
      {mode !== "redeem" && (
        <>
          <div className="mt-5 flex items-center justify-between">
            <label className="text-sm font-semibold text-[#40564a]" htmlFor="trade-amount">
              {mode === "buy" ? "Amount (G$)" : "Shares"}
            </label>
            {balanceFormatted && (
              <span className="text-xs text-[#5a6b60]">
                Balance: <span className="font-semibold">{balanceFormatted}</span>
              </span>
            )}
          </div>
          <div className="mt-2 flex h-12 items-center rounded border border-[#cfded2] bg-white px-3 focus-within:border-[#35d07f]">
            <span className="font-semibold text-[#5a6b60]">{mode === "buy" ? "G$" : "#"}</span>
            <input
              id="trade-amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="decimal"
              className="min-w-0 flex-1 bg-transparent px-2 text-lg font-semibold outline-none"
            />
          </div>
        </>
      )}

      {/* Preview (buy only) */}
      {mode === "buy" && (
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
      )}

      {/* Redeem info */}
      {mode === "redeem" && (
        <div className="mt-5 rounded border border-[#edf2ee] bg-[#fbfdfb] p-4 text-sm">
          {market.resolved ? (
            <p className="text-[#2b9d62] font-semibold">
              Market resolved: {market.winningOutcome === 1 ? "YES" : "NO"} won. Redeem your winning shares for G$.
            </p>
          ) : (
            <p className="text-[#5a6b60]">Market is still active. Redeem will be available once resolved.</p>
          )}
        </div>
      )}

      {/* Identity warning */}
      {isConnected && !identityLoading && !isWhitelisted && (
        <div className="mt-4 rounded border border-[#eadb8a] bg-[#fff9df] px-3 py-2 text-xs font-semibold text-[#6b580f]">
          Your wallet is not GoodDollar-verified. Trades are gated by identity.
        </div>
      )}

      {/* CTA button */}
      <button
        type="button"
        disabled={btn.disabled}
        onClick={btn.action}
        className="mt-5 h-12 w-full rounded bg-[#132019] px-4 text-sm font-bold text-white hover:bg-[#23362a] disabled:cursor-not-allowed disabled:bg-[#9aa79f]"
      >
        {btn.label}
      </button>

      {/* Tx success links */}
      {tradeConfirmed && tradeTxHash && (
        <a
          href={`https://celoscan.io/tx/${tradeTxHash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 block text-center text-xs font-semibold text-[#2b9d62] hover:underline"
        >
          View transaction ↗
        </a>
      )}

      {/* Liquidity footer */}
      <div className="mt-5 flex justify-between border-t border-[#edf2ee] pt-4 text-sm">
        <span className="text-[#5a6b60]">Liquidity</span>
        <span className="font-semibold">{formatGdollar(market.totalCollateralFormatted)}</span>
      </div>
    </aside>
  );
}