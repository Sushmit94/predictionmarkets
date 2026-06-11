"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseEther, formatEther } from "viem";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { formatGdollar, formatProbability } from "@/lib/format";
import { previewBuy } from "@/lib/lmsr";
import { CONTRACTS, ERC1155_ABI, ERC20_ABI, PREDICTION_MARKET_ABI } from "@/lib/wagmi";
import { useIdentity } from "@/hooks/useIdentity";
import { useGDollarBalance, useGDollarAllowance } from "@/hooks/useGDollar";
import type { Market } from "@/lib/types";

type TradeMode = "buy" | "sell" | "redeem";

const APPROVE_GAS_LIMIT = BigInt(120_000);
const TRADE_GAS_LIMIT = BigInt(650_000);
const REDEEM_GAS_LIMIT = BigInt(350_000);

// ─── Payout estimate helper ───────────────────────────────────────────────────
// After user buys `newShares` of `outcome`, what is their estimated redemption?
//   payout = (userShares / totalWinningSideShares) × totalCollateral
// This is the parimutuel formula — pool splits among winners proportionally.
function estimatePayout(
  yesSharesRaw: string,
  noSharesRaw: string,
  totalCollateralRaw: string,
  amountSpent: number,
  newShares: number,
  outcome: "YES" | "NO",
): {
  estimatedClaim: number;
  poolYes: number;
  poolNo: number;
  userSharePct: number;
} {
  const currentYes = Number(BigInt(yesSharesRaw || "0")) / 1e18;
  const currentNo = Number(BigInt(noSharesRaw || "0")) / 1e18;
  const totalCollateral = Number(BigInt(totalCollateralRaw || "0")) / 1e18;

  const afterYes = outcome === "YES"
    ? currentYes + newShares
    : currentYes;

  const afterNo = outcome === "NO"
    ? currentNo + newShares
    : currentNo;

  const winningSideShares =
    outcome === "YES"
      ? afterYes
      : afterNo;

  const userSharePct =
    winningSideShares > 0
      ? (newShares / winningSideShares) * 100
      : 0;

  const poolAfterTrade =
    totalCollateral + amountSpent;

  const estimatedClaim =
    winningSideShares > 0
      ? (newShares / winningSideShares) * poolAfterTrade
      : 0;

  return {
    estimatedClaim,
    poolYes: afterYes,
    poolNo: afterNo,
    userSharePct,
  };
}

export function TradePanel({ market }: { market: Market }) {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();

  const [mode, setMode]       = useState<TradeMode>("buy");
  const [outcome, setOutcome] = useState<"YES" | "NO">("YES");
  const [amount, setAmount]   = useState("100");
  const [showPoolInfo, setShowPoolInfo] = useState(false);
  const [syncingConfirmedTrade, setSyncingConfirmedTrade] = useState(false);

  const numericAmount = Number(amount);
  const amountWei     = parseEther(Number.isFinite(numericAmount) && numericAmount > 0 ? amount : "0");
  const marketAddress = market.address as `0x${string}`;

  const { isWhitelisted, isLoading: identityLoading } = useIdentity(address);
  const { data: marketGdollarAddress, isLoading: collateralLoading } = useReadContract({
    address: marketAddress,
    abi: PREDICTION_MARKET_ABI,
    functionName: "gDollar",
    query: { enabled: isConnected },
  });
  const collateralAddress = marketGdollarAddress ?? CONTRACTS.G_DOLLAR;
  const { balance, balanceLoading, refetchBalance }   = useGDollarBalance(address, collateralAddress);
  const { allowance, refetchAllowance }               = useGDollarAllowance(address, marketAddress, collateralAddress);
  const { data: outcomeTokenAddress } = useReadContract({
    address: marketAddress,
    abi: PREDICTION_MARKET_ABI,
    functionName: "tokens",
    query: { enabled: isConnected },
  });
  const {
    data: yesShareBalance,
    refetch: refetchYesShareBalance,
  } = useReadContract({
    address: outcomeTokenAddress,
    abi: ERC1155_ABI,
    functionName: "balanceOf",
    args: address ? [address, BigInt(1)] : undefined,
    query: { enabled: !!address && !!outcomeTokenAddress },
  });
  const {
    data: noShareBalance,
    refetch: refetchNoShareBalance,
  } = useReadContract({
    address: outcomeTokenAddress,
    abi: ERC1155_ABI,
    functionName: "balanceOf",
    args: address ? [address, BigInt(0)] : undefined,
    query: { enabled: !!address && !!outcomeTokenAddress },
  });
  const {
    data: winningShareBalance,
    isLoading: winningShareBalanceLoading,
    refetch: refetchWinningShareBalance,
  } = useReadContract({
    address: outcomeTokenAddress,
    abi: ERC1155_ABI,
    functionName: "balanceOf",
    args: address && market.winningOutcome !== null ? [address, BigInt(market.winningOutcome)] : undefined,
    query: {
      enabled: !!address && !!outcomeTokenAddress && market.resolved && market.winningOutcome !== null,
    },
  });

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

  useEffect(() => {
    if (approveConfirmed) {
      refetchAllowance();
    }
  }, [approveConfirmed, refetchAllowance]);

  useEffect(() => {
    if (tradeConfirmed) {
      setSyncingConfirmedTrade(true);
      refetchBalance();
      refetchWinningShareBalance();
      refetchYesShareBalance();
      refetchNoShareBalance();
      refetchAllowance();
      router.refresh();

      const refreshTimer = window.setTimeout(() => {
        router.refresh();
        setSyncingConfirmedTrade(false);
      }, 8_000);

      return () => window.clearTimeout(refreshTimer);
    }
  }, [
    tradeConfirmed,
    refetchAllowance,
    refetchBalance,
    refetchNoShareBalance,
    refetchWinningShareBalance,
    refetchYesShareBalance,
    router,
  ]);

  const preview = useMemo(() => {
    return previewBuy(
      market.yesShares,
      market.noShares,
      Number.isFinite(numericAmount) ? numericAmount : 0,
      outcome,
    );
  }, [market.noShares, market.yesShares, numericAmount, outcome]);

  // Payout estimate — only meaningful after we know expected shares
  const payoutEstimate = useMemo(() => {
    if (mode !== "buy" || preview.expectedShares <= 0 || numericAmount <= 0) return null;
 return estimatePayout(
  market.yesShares,
  market.noShares,
  market.totalCollateral,
  numericAmount,
  preview.expectedShares,
  outcome,
);
  }, [mode, preview.expectedShares, numericAmount, market.yesShares, market.noShares, market.totalCollateral, outcome]);

  const needsApproval    = mode === "buy" && allowance < amountWei;
  const hasEnoughBalance = balance >= amountWei;
  const outcomeIndex     = outcome === "YES" ? 1 : 0;
  const redeemableWinningShares = winningShareBalance ?? BigInt(0);

  function getButtonState(): { label: string; disabled: boolean; action: () => void } {
    if (!isConnected)
      return { label: "Connect Wallet", disabled: false, action: () => openConnectModal?.() };
    if (identityLoading)
      return { label: "Checking identity…", disabled: true, action: () => {} };
    if (balanceLoading)
      return { label: "Loading balance…", disabled: true, action: () => {} };
    if (collateralLoading)
      return { label: "Loading market token…", disabled: true, action: () => {} };
    if (!isWhitelisted)
      return {
        label: "Get GoodDollar Verified",
        disabled: false,
        action: () => window.open("https://gooddapp.org/#/face-verification", "_blank"),
      };
    if (approving || waitingApprove)
      return { label: "Approving G$…", disabled: true, action: () => {} };
    if (trading || waitingTrade)
      return { label: "Confirming…", disabled: true, action: () => {} };
    if (syncingConfirmedTrade)
      return { label: "Updating market…", disabled: true, action: () => {} };
    // Add this — disable buy/sell if market has ended or resolved
if (mode === "buy" || mode === "sell") {
  const now = Math.floor(Date.now() / 1000);
  const endTimeUnix = Math.floor(new Date(market.endTime).getTime() / 1000);
  if (market.resolved) {
    return { label: "Market resolved", disabled: true, action: () => {} };
  }
  if (now >= endTimeUnix) {
    return { label: "Market ended — awaiting resolution", disabled: true, action: () => {} };
  }
}
    if (mode === "redeem") {
      if (!market.resolved)
        return { label: "Market not resolved", disabled: true, action: () => {} };
      if (market.winningOutcome === null)
        return { label: "Winner not available", disabled: true, action: () => {} };
      if (winningShareBalanceLoading)
        return { label: "Checking winnings…", disabled: true, action: () => {} };
      if (redeemableWinningShares === BigInt(0))
        return { label: "No winnings to redeem", disabled: true, action: () => {} };
      return {
        label: "Redeem winnings",
        disabled: false,
        action: () => writeTrade({
          address: marketAddress,
          abi: PREDICTION_MARKET_ABI,
          functionName: "redeem",
          args: [],
          gas: REDEEM_GAS_LIMIT,
        }),
      };
    }

    if (mode === "buy") {
      if (!hasEnoughBalance) return { label: "Insufficient G$ balance", disabled: true, action: () => {} };
      if (numericAmount <= 0) return { label: "Enter an amount", disabled: true, action: () => {} };
      if (preview.expectedShares <= 0) return { label: "Unable to quote trade", disabled: true, action: () => {} };
      if (needsApproval) {
        return {
          label: `Approve G$${numericAmount}`,
          disabled: false,
          action: () => writeApprove({
            address: collateralAddress,
            abi: ERC20_ABI,
            functionName: "approve",
            args: [marketAddress, amountWei],
            gas: APPROVE_GAS_LIMIT,
          }),
        };
      }
      const sharesWei = parseEther((preview.expectedShares * 0.95).toFixed(6));
      return {
        label: `Buy ${outcome}`,
        disabled: false,
        action: () => writeTrade({
          address: marketAddress,
          abi: PREDICTION_MARKET_ABI,
          functionName: "buy",
          args: [outcomeIndex, sharesWei, amountWei],
          gas: TRADE_GAS_LIMIT,
        }),
      };
    }

    if (numericAmount <= 0) return { label: "Enter shares to sell", disabled: true, action: () => {} };
    return {
      label: `Sell ${outcome}`,
      disabled: false,
      action: () => writeTrade({
        address: marketAddress,
        abi: PREDICTION_MARKET_ABI,
        functionName: "sell",
        args: [outcomeIndex, amountWei, parseEther((numericAmount * 0.95).toFixed(6))],
        gas: TRADE_GAS_LIMIT,
      }),
    };
  }

  const btn             = getButtonState();
  const balanceFormatted = isConnected ? `G$${Number(formatEther(balance)).toFixed(2)}` : null;
  const yesShareBalanceFormatted = Number(formatEther(yesShareBalance ?? BigInt(0)));
  const noShareBalanceFormatted = Number(formatEther(noShareBalance ?? BigInt(0)));
  const hasShareBalance = yesShareBalanceFormatted > 0 || noShareBalanceFormatted > 0;

  // Pool sizes for the breakdown section
  const poolYes   = Number(BigInt(market.yesShares   || "0")) / 1e18;
  const poolNo    = Number(BigInt(market.noShares    || "0")) / 1e18;
  const poolTotal = poolYes + poolNo;

  return (
    <aside className="rounded-lg border border-[#dce8dd] bg-white p-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">Trade</h2>
        <span className="rounded bg-[#e9fff1] px-2 py-1 text-xs font-bold text-[#116636]">G$</span>
      </div>

      {/* Mode tabs */}
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

      {/* YES / NO tabs */}
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
          {isConnected && (
            <div className="mt-4 grid grid-cols-2 gap-2 rounded border border-[#dce8dd] bg-[#fbfdfb] p-3 text-sm">
              <div>
                <p className="text-xs font-semibold uppercase text-[#5a6b60]">Your YES</p>
                <p className="mt-1 font-black text-[#132019]">{yesShareBalanceFormatted.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-[#5a6b60]">Your NO</p>
                <p className="mt-1 font-black text-[#132019]">{noShareBalanceFormatted.toFixed(2)}</p>
              </div>
            </div>
          )}
          {isConnected && hasShareBalance && (
            <p className="mt-2 text-xs font-semibold text-[#2b9d62]">
              These balances are read directly from the market share token.
            </p>
          )}
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

      {/* ── Buy preview ──────────────────────────────────────────────────────── */}
      {mode === "buy" && (
        <div className="mt-5 space-y-3 rounded border border-[#edf2ee] bg-[#fbfdfb] p-4 text-sm">
          {/* Standard LMSR stats */}
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

          {/* ── Divider ── */}
          {payoutEstimate && numericAmount > 0 && (
            <>
              <div className="border-t border-[#e2ebe3] pt-3">
                {/* Estimated payout section */}
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wide text-[#40564a]">
                    If {outcome} wins
                  </span>
                  <span className="rounded bg-[#e9fff1] px-1.5 py-0.5 text-[10px] font-bold text-[#116636]">
                    estimated
                  </span>
                </div>

                <div className="flex justify-between gap-3">
                  <span className="text-[#5a6b60]">You pay</span>
                  <span className="font-semibold">G${numericAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between gap-3 mt-1">
               <span className="text-[#5a6b60]">
  Estimated claim
</span>

<span className="font-semibold text-[#1a7a45]">
  G${payoutEstimate.estimatedClaim.toFixed(2)}
</span>
                </div>
                {/* <div className="flex justify-between gap-3 mt-1">
                  <span className="text-[#5a6b60]">Profit</span>
                  <span className={`font-semibold ${payoutEstimate.typical - numericAmount >= 0 ? "text-[#1a7a45]" : "text-[#c0392b]"}`}>
                    {payoutEstimate.typical - numericAmount >= 0 ? "+" : ""}
                    G${(payoutEstimate.typical - numericAmount).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between gap-3 mt-1">
                  <span className="text-[#5a6b60]">Your pool share</span>
                  <span className="font-semibold">{payoutEstimate.userSharePct.toFixed(1)}%</span>
                </div> */}

                {/* Disclaimer */}
                <p className="mt-2 text-[10px] leading-relaxed text-[#8a9e90]">
               Estimate assumes the market resolved immediately after this trade.
Actual payout depends on future traders and final pool size.
                </p>
              </div>

              {/* ── Pool breakdown ── */}
              <div className="border-t border-[#e2ebe3] pt-3">
                <button
                  type="button"
                  onClick={() => setShowPoolInfo((v) => !v)}
                  className="flex w-full items-center justify-between text-xs font-bold uppercase tracking-wide text-[#40564a]"
                >
                  <span>Current pool</span>
                  <span className="text-[#5a6b60]">{showPoolInfo ? "▲" : "▼"}</span>
                </button>

                {showPoolInfo && (
                  <div className="mt-2 space-y-2">
                    {/* YES bar */}
                    <div>
                      <div className="flex justify-between text-xs text-[#5a6b60] mb-1">
                        <span>YES side</span>
                        <span className="font-semibold">
                          {payoutEstimate.poolYes.toFixed(1)} shares
                          {" "}
                          <span className="text-[#8a9e90]">
                            ({poolTotal > 0 ? ((payoutEstimate.poolYes / (payoutEstimate.poolYes + payoutEstimate.poolNo)) * 100).toFixed(0) : 50}%)
                          </span>
                        </span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-[#e2ebe3]">
                        <div
                          className="h-1.5 rounded-full bg-[#35d07f]"
                          style={{
                            width: `${
                              payoutEstimate.poolYes + payoutEstimate.poolNo > 0
                                ? (payoutEstimate.poolYes / (payoutEstimate.poolYes + payoutEstimate.poolNo)) * 100
                                : 50
                            }%`,
                          }}
                        />
                      </div>
                    </div>

                    {/* NO bar */}
                    <div>
                      <div className="flex justify-between text-xs text-[#5a6b60] mb-1">
                        <span>NO side</span>
                        <span className="font-semibold">
                          {payoutEstimate.poolNo.toFixed(1)} shares
                          {" "}
                          <span className="text-[#8a9e90]">
                            ({poolTotal > 0 ? ((payoutEstimate.poolNo / (payoutEstimate.poolYes + payoutEstimate.poolNo)) * 100).toFixed(0) : 50}%)
                          </span>
                        </span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-[#e2ebe3]">
                        <div
                          className="h-1.5 rounded-full bg-[#e05c5c]"
                          style={{
                            width: `${
                              payoutEstimate.poolYes + payoutEstimate.poolNo > 0
                                ? (payoutEstimate.poolNo / (payoutEstimate.poolYes + payoutEstimate.poolNo)) * 100
                                : 50
                            }%`,
                          }}
                        />
                      </div>
                    </div>

                    <div className="flex justify-between text-xs text-[#5a6b60]">
                      <span>Total collateral</span>
                      <span className="font-semibold">{formatGdollar(market.totalCollateralFormatted)}</span>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Redeem info ───────────────────────────────────────────────────────── */}
      {mode === "redeem" && (
        <div className="mt-5 rounded border border-[#edf2ee] bg-[#fbfdfb] p-4 text-sm">
          {market.resolved ? (
            <p className={`font-semibold ${redeemableWinningShares > BigInt(0) ? "text-[#2b9d62]" : "text-[#5a6b60]"}`}>
              {redeemableWinningShares > BigInt(0)
                ? `Market resolved: ${market.winningOutcome === 1 ? "YES" : "NO"} won. Redeem your winning shares for G$.`
                : "You have no redeemable winning shares for this market."}
            </p>
          ) : (
            <p className="text-[#5a6b60]">Market is still active. Redeem will be available once resolved.</p>
          )}
        </div>
      )}

      {/* ── Settlement model badge ────────────────────────────────────────────── */}
      {mode === "buy" && (
        <div className="mt-4 flex items-start gap-2 rounded border border-[#dce8dd] bg-[#f5fbf6] px-3 py-2">
          {/* info icon */}
          <svg
            className="mt-0.5 shrink-0 text-[#116636]"
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="8" />
            <line x1="12" y1="12" x2="12" y2="16" />
          </svg>
          <div className="min-w-0">
            <p className="text-xs font-bold text-[#116636]">Parimutuel settlement</p>
            <p className="mt-0.5 text-[10px] leading-relaxed text-[#5a6b60]">
              Winners split the full collateral pool proportionally. The market price reflects crowd probability —
              your actual payout depends on final pool size at resolution.
            </p>
          </div>
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

      {/* Tx success link */}
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
