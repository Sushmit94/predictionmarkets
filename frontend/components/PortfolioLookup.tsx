"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { isAddress } from "@/lib/format";

export function PortfolioLookup({ initialAddress = "" }: { initialAddress?: string }) {
  const router = useRouter();
  const [address, setAddress] = useState(initialAddress);
  const valid = address === "" || isAddress(address);

  return (
    <form
      className="rounded-lg border border-[#dce8dd] bg-white p-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (isAddress(address)) router.push(`/portfolio?address=${address}`);
      }}
    >
      <label htmlFor="wallet-address" className="text-sm font-semibold text-[#40564a]">
        Wallet address
      </label>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        <input
          id="wallet-address"
          value={address}
          onChange={(event) => setAddress(event.target.value)}
          placeholder="0x..."
          className="h-12 min-w-0 flex-1 rounded border border-[#cfded2] px-3 font-mono text-sm outline-none focus:border-[#35d07f]"
        />
        <button
          type="submit"
          disabled={!isAddress(address)}
          className="h-12 rounded bg-[#132019] px-5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-[#9aa79f]"
        >
          Load
        </button>
      </div>
      {!valid ? <p className="mt-2 text-sm font-medium text-[#a33b2b]">Enter a valid Celo address.</p> : null}
    </form>
  );
}
