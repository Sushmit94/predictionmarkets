import Link from "next/link";
import type { ReactNode } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f8faf7] text-[#132019]">
      <header className="sticky top-0 z-20 border-b border-[#dce8dd] bg-[#f8faf7]/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-3" aria-label="CeloMarket home">
            <span className="grid size-9 place-items-center rounded bg-[#35d07f] font-black text-[#092014]">C</span>
            <span className="text-lg font-semibold">CeloMarket</span>
          </Link>
          <div className="flex items-center gap-1">
            <nav className="flex items-center gap-1 text-sm font-medium text-[#40564a]">
              <Link className="rounded px-3 py-2 hover:bg-[#e9f3eb] hover:text-[#132019]" href="/landing">
                Markets
              </Link>
              <Link className="rounded px-3 py-2 hover:bg-[#e9f3eb] hover:text-[#132019]" href="/portfolio">
                Portfolio
              </Link>
            </nav>
            <ConnectButton
              showBalance={false}
              chainStatus="icon"
              accountStatus="avatar"
            />
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}