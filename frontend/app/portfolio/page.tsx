import { AppShell } from "@/components/AppShell";
import { PortfolioLookup } from "@/components/PortfolioLookup";
import { PortfolioTable } from "@/components/PortfolioTable";
import { getPositions } from "@/lib/api";
import { formatGdollar, isAddress, shortenAddress } from "@/lib/format";

const demoAddress = "0x93a4f6E4f2419dB3e73A0d06B83D3B691515fD23";

export default async function Portfolio({
  searchParams,
}: {
  searchParams: Promise<{ address?: string }>;
}) {
  const params = await searchParams;
  const address = isAddress(params.address ?? "") ? params.address! : demoAddress;
  const { data: positions } = await getPositions(address);
  const exposure = positions.reduce((sum, position) => sum + Number(position.buyCollateralFormatted), 0);
  const trades = positions.reduce((sum, position) => sum + position.tradeCount, 0);

  return (
    <AppShell>
      <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <section className="grid gap-5 lg:grid-cols-[1fr_420px] lg:items-end">
          <div>
            <p className="text-sm font-semibold uppercase text-[#2b9d62]">Portfolio</p>
            <h1 className="mt-3 text-4xl font-black leading-tight tracking-normal text-[#132019]">
              {shortenAddress(address)}
            </h1>
            <p className="mt-4 max-w-2xl text-lg leading-8 text-[#40564a]">
              YES and NO positions across indexed CeloMarket contracts.
            </p>
          </div>
          <PortfolioLookup initialAddress={address} />
        </section>

        <section className="mt-6 grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-[#dce8dd] bg-white p-4">
            <p className="text-sm font-semibold text-[#5a6b60]">Positions</p>
            <p className="mt-2 text-3xl font-black">{positions.length}</p>
          </div>
          <div className="rounded-lg border border-[#dce8dd] bg-white p-4">
            <p className="text-sm font-semibold text-[#5a6b60]">Exposure</p>
            <p className="mt-2 text-3xl font-black">{formatGdollar(exposure)}</p>
          </div>
          <div className="rounded-lg border border-[#dce8dd] bg-white p-4">
            <p className="text-sm font-semibold text-[#5a6b60]">Trades</p>
            <p className="mt-2 text-3xl font-black">{trades}</p>
          </div>
        </section>

        <div className="mt-6">
          <PortfolioTable positions={positions} />
        </div>
      </main>
    </AppShell>
  );
}
