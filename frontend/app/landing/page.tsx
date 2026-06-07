import Link from "next/link";
import { LandingShell } from "@/components/Landingshell";

export default function LandingPage() {
    return (
        <LandingShell>
            {/* NAV */}
            <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-5 sm:px-6 lg:px-8">
                <div className="flex items-center gap-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#2d6a4f]">
                        <span className="text-sm font-black text-white">C</span>
                    </div>
                    <span className="text-lg font-black text-[#132019]">CeloMarket</span>
                </div>
                <div className="flex items-center gap-6">
                    <Link
                        href="/markets"
                        className="text-sm font-semibold text-[#40564a] hover:text-[#132019] transition-colors"
                    >
                        Markets
                    </Link>
                    <Link
                        href="/portfolio"
                        className="text-sm font-semibold text-[#40564a] hover:text-[#132019] transition-colors"
                    >
                        Portfolio
                    </Link>
                    <Link
                        href="/markets"
                        className="rounded-lg bg-[#2d6a4f] px-4 py-2 text-sm font-bold text-white hover:bg-[#1b4332] transition-colors"
                    >
                        Launch App →
                    </Link>
                </div>
            </nav>

            {/* HERO */}
            <section className="mx-auto max-w-7xl px-4 pt-16 pb-20 sm:px-6 lg:px-8">
                <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
                    <div>
                        <span className="inline-flex items-center gap-2 rounded-full border border-[#dce8dd] bg-white px-3 py-1 text-xs font-semibold text-[#2d6a4f]">
                            <span className="h-1.5 w-1.5 rounded-full bg-[#40b374] inline-block" />
                            Live on Celo Mainnet
                        </span>
                        <h1 className="mt-5 text-5xl font-black leading-tight tracking-tight text-[#132019] sm:text-6xl">
                            Prediction markets
                            <br />
                            settled in{" "}
                            <span className="text-[#2d6a4f]">G$</span>
                        </h1>
                        <p className="mt-5 max-w-lg text-lg leading-8 text-[#40564a]">
                            Trade YES/NO positions on real-world outcomes using GoodDollar.
                            Prices are set by LMSR — a provably fair automated market maker —
                            and every trade settles on-chain.
                        </p>
                        <div className="mt-8 flex flex-wrap gap-3">
                            <Link
                                href="/markets"
                                className="rounded-lg bg-[#132019] px-6 py-3 text-sm font-bold text-white hover:bg-[#0d1610] transition-colors"
                            >
                                Browse Markets
                            </Link>
                            <Link
                                href="/portfolio"
                                className="rounded-lg border border-[#dce8dd] bg-white px-6 py-3 text-sm font-bold text-[#132019] hover:border-[#2d6a4f] transition-colors"
                            >
                                View Portfolio
                            </Link>
                        </div>
                    </div>

                    {/* MOCK MARKET CARD */}
                    <div className="relative">
                        <div className="absolute -top-4 -left-4 h-full w-full rounded-2xl border-2 border-[#dce8dd] bg-[#eef4ef]" />
                        <div className="relative rounded-2xl border border-[#dce8dd] bg-white p-6 shadow-sm">
                            <div className="flex items-center justify-between">
                                <span className="rounded-full border border-[#d1f0dd] bg-[#edfaf2] px-2.5 py-0.5 text-xs font-semibold text-[#2d6a4f]">
                                    Active
                                </span>
                                <span className="text-xs text-[#5a6b60]">29d left</span>
                            </div>
                            <p className="mt-3 text-xs font-bold uppercase tracking-wider text-[#2d6a4f]">
                                CRYPTO
                            </p>
                            <h3 className="mt-1 text-lg font-black text-[#132019]">
                                Will CELO trade above $0.06 before July 31, 2026?
                            </h3>
                            <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-[#f0f5f0]">
                                <div className="h-full w-[58%] rounded-full bg-[#40b374]" />
                            </div>
                            <div className="mt-3 grid grid-cols-2 gap-3">
                                <button className="rounded-lg border-2 border-[#40b374] bg-[#edfaf2] py-2.5 text-sm font-bold text-[#2d6a4f]">
                                    YES — 58¢
                                </button>
                                <button className="rounded-lg border-2 border-[#dce8dd] bg-white py-2.5 text-sm font-bold text-[#40564a]">
                                    NO — 42¢
                                </button>
                            </div>
                            <p className="mt-3 text-right text-xs text-[#5a6b60]">
                                Volume: <span className="font-bold text-[#132019]">G$9.5</span>
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* STATS BAR */}
            <section className="border-y border-[#dce8dd] bg-white">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                    <div className="grid grid-cols-3 divide-x divide-[#dce8dd]">
                        {[
                            { label: "Active Markets", value: "1" },
                            { label: "Total Volume", value: "G$9.5" },
                            { label: "Settlement Token", value: "GoodDollar" },
                        ].map((stat) => (
                            <div key={stat.label} className="py-8 px-6 text-center">
                                <p className="text-2xl font-black text-[#132019]">{stat.value}</p>
                                <p className="mt-1 text-sm text-[#5a6b60]">{stat.label}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* HOW IT WORKS */}
            <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
                <h2 className="text-3xl font-black text-[#132019]">How it works</h2>
                <p className="mt-2 text-[#40564a]">Three steps to your first prediction.</p>
                <div className="mt-10 grid gap-6 sm:grid-cols-3">
                    {[
                        {
                            step: "01",
                            title: "Connect your wallet",
                            desc: "Use any Celo-compatible wallet. Your address is your identity — no sign-up required.",
                        },
                        {
                            step: "02",
                            title: "Pick a market",
                            desc: "Browse active questions. Each market has YES and NO shares priced by the LMSR algorithm in real time.",
                        },
                        {
                            step: "03",
                            title: "Trade & redeem",
                            desc: "Buy shares with G$. If your prediction is correct, redeem your winning shares for GoodDollar after resolution.",
                        },
                    ].map((item) => (
                        <div
                            key={item.step}
                            className="rounded-xl border border-[#dce8dd] bg-white p-6"
                        >
                            <span className="text-4xl font-black text-[#dce8dd]">{item.step}</span>
                            <h3 className="mt-3 text-lg font-bold text-[#132019]">{item.title}</h3>
                            <p className="mt-2 text-sm leading-6 text-[#5a6b60]">{item.desc}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* LMSR EXPLAINER */}
            <section className="bg-[#132019]">
                <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
                    <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
                        <div>
                            <h2 className="text-3xl font-black text-white">
                                Fair prices, always.
                                <br />
                                <span className="text-[#40b374]">Powered by LMSR.</span>
                            </h2>
                            <p className="mt-4 leading-7 text-[#8aab97]">
                                The Logarithmic Market Scoring Rule (LMSR) is the gold-standard
                                automated market maker for prediction markets. It guarantees
                                liquidity at every price point and prevents manipulation — the
                                price you see is always mathematically fair based on current
                                positions.
                            </p>
                            <ul className="mt-6 space-y-3">
                                {[
                                    "No order books — instant fills at LMSR price",
                                    "Prices reflect aggregate market belief",
                                    "Liquidity parameter set at market creation",
                                    "All logic is on-chain and verifiable",
                                ].map((point) => (
                                    <li key={point} className="flex items-start gap-2 text-sm text-[#8aab97]">
                                        <span className="mt-0.5 text-[#40b374]">✓</span>
                                        {point}
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <div className="rounded-xl border border-[#2d6a4f] bg-[#0d1610] p-6">
                            <p className="text-xs font-mono text-[#40b374]">// LMSR pricing formula</p>
                            <pre className="mt-3 text-sm font-mono leading-6 text-[#8aab97]">
                                {`cost = b × log(
  eˢʸᵉˢ/ᵇ + eˢⁿᵒ/ᵇ
)

price(YES) = eˢʸᵉˢ/ᵇ / (
  eˢʸᵉˢ/ᵇ + eˢⁿᵒ/ᵇ
)`}
                            </pre>
                            <p className="mt-4 text-xs text-[#40564a]">
                                b = liquidity parameter · s = outstanding shares
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* CTA */}
            <section className="mx-auto max-w-7xl px-4 py-20 text-center sm:px-6 lg:px-8">
                <h2 className="text-4xl font-black text-[#132019]">
                    Start predicting today.
                </h2>
                <p className="mx-auto mt-4 max-w-md text-[#40564a]">
                    Markets are live. Prices are updating. Your first trade is one click away.
                </p>
                <div className="mt-8 flex justify-center gap-3">
                    <Link
                        href="/markets"
                        className="rounded-lg bg-[#2d6a4f] px-8 py-3 text-sm font-bold text-white hover:bg-[#1b4332] transition-colors"
                    >
                        Open Markets →
                    </Link>
                </div>
            </section>

            {/* FOOTER */}
            <footer className="border-t border-[#dce8dd] bg-white">
                <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-6 sm:px-6 lg:px-8">
                    <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[#2d6a4f]">
                            <span className="text-xs font-black text-white">C</span>
                        </div>
                        <span className="text-sm font-bold text-[#132019]">CeloMarket</span>
                    </div>
                    <p className="text-xs text-[#5a6b60]">
                        Built on Celo · Settled in G$ · Powered by LMSR
                    </p>
                </div>
            </footer>
        </LandingShell>
    );
}