"use client";

import Link from "next/link";
import { motion, Variants } from "framer-motion";
import { LandingShell } from "@/components/Landingshell";

// Explicitly typing variants fixes the TypeScript conversion/inference error
const fadeIn: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: "easeOut" }
  }
};

const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15
    }
  }
};

export default function LandingPage() {
  return (
    <LandingShell>
      {/* NAV */}
      <motion.nav
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mx-auto flex max-w-7xl items-center justify-between px-4 py-5 sm:px-6 lg:px-8"
      >
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#2d6a4f]">
            <span className="text-sm font-black text-white">C</span>
          </div>
          <span className="text-lg font-black text-[#132019]">CeloMarket</span>
        </div>
        <div className="flex items-center gap-6">
          <Link
            href="/landing"
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
          <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }}>
            <Link
              href="/landing"
              className="rounded-lg bg-[#2d6a4f] px-4 py-2 text-sm font-bold text-white hover:bg-[#1b4332] transition-colors inline-block"
            >
              Launch App →
            </Link>
          </motion.div>
        </div>
      </motion.nav>

      {/* HERO */}
      <section className="mx-auto max-w-7xl px-4 pt-16 pb-20 sm:px-6 lg:px-8 overflow-hidden">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={staggerContainer}
          >
            <motion.span
              variants={fadeIn}
              className="inline-flex items-center gap-2 rounded-full border border-[#dce8dd] bg-white px-3 py-1 text-xs font-semibold text-[#2d6a4f]"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-[#40b374] animate-pulse" />
              Live on Celo Mainnet
            </motion.span>

            <motion.h1
              variants={fadeIn}
              className="mt-5 text-5xl font-black leading-tight tracking-tight text-[#132019] sm:text-6xl"
            >
              Prediction markets
              <br />
              settled in{" "}
              <span className="text-[#2d6a4f]">G$</span>
            </motion.h1>

            <motion.p
              variants={fadeIn}
              className="mt-5 max-w-lg text-lg leading-8 text-[#40564a]"
            >
              Trade YES/NO positions on real-world outcomes using GoodDollar.
              Prices are set by LMSR — a provably fair automated market maker —
              and every trade settles on-chain.
            </motion.p>

            <motion.div variants={fadeIn} className="mt-8 flex flex-wrap gap-3">
              <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                <Link
                  href="/landing"
                  className="rounded-lg bg-[#132019] px-6 py-3 text-sm font-bold text-white hover:bg-[#0d1610] transition-colors inline-block"
                >
                  Browse Markets
                </Link>
              </motion.div>
              <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                <Link
                  href="/portfolio"
                  className="rounded-lg border border-[#dce8dd] bg-white px-6 py-3 text-sm font-bold text-[#132019] hover:border-[#2d6a4f] transition-colors inline-block"
                >
                  View Portfolio
                </Link>
              </motion.div>
            </motion.div>
          </motion.div>

          {/* MOCK MARKET CARD */}
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7, delay: 0.2, ease: "easeOut" }}
            className="relative"
          >
            <div className="absolute -top-4 -left-4 h-full w-full rounded-2xl border-2 border-[#dce8dd] bg-[#eef4ef]" />
            <motion.div
              whileHover={{ y: -6 }}
              transition={{ duration: 0.3 }}
              className="relative rounded-2xl border border-[#dce8dd] bg-white p-6 shadow-md"
            >
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
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: "58%" }}
                  transition={{ duration: 1, delay: 0.5, ease: "easeInOut" }}
                  className="h-full rounded-full bg-[#40b374]"
                />
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="rounded-lg border-2 border-[#40b374] bg-[#edfaf2] py-2.5 text-sm font-bold text-[#2d6a4f]"
                >
                  YES — 58¢
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="rounded-lg border-2 border-[#dce8dd] bg-white py-2.5 text-sm font-bold text-[#40564a]"
                >
                  NO — 42¢
                </motion.button>
              </div>
              <p className="mt-3 text-right text-xs text-[#5a6b60]">
                Volume: <span className="font-bold text-[#132019]">G$9.5</span>
              </p>
            </motion.div>
          </motion.div>
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
            ].map((stat, idx) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: idx * 0.1 }}
                className="py-8 px-6 text-center"
              >
                <p className="text-2xl font-black text-[#132019]">{stat.value}</p>
                <p className="mt-1 text-sm text-[#5a6b60]">{stat.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CORE ADVANTAGES */}
      <section className="bg-[#eef4ef]/40 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl font-black text-[#132019]">Built for Impact. Crafted for Web3.</h2>
            <p className="mt-2 text-[#40564a]">Why tracking global opinions on CeloMarket hits differently.</p>
          </div>
          <div className="grid gap-8 md:grid-cols-3">
            {[
              {
                title: "Impact Economy Integration",
                desc: "Put your GoodDollar (G$) assets to work. Turn your UBI or community wealth into predictive power in market dynamics."
              },
              {
                title: "Sub-Cent Gas Fees",
                desc: "Powered by Celo's ultra-low gas infrastructure. Put up or exit positions freely without heavy fees burning your trading yield."
              },
              {
                title: "Zero Counterparty Risk",
                desc: "No corporate treasuries, no black boxes. Escrows and liquidity provisions live natively in automated smart contracts."
              }
            ].map((feature, idx) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 25 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.5, delay: idx * 0.1 }}
                whileHover={{ y: -4 }}
                className="bg-white border border-[#dce8dd] p-8 rounded-xl shadow-sm"
              >
                <h3 className="text-lg font-bold text-[#132019]">{feature.title}</h3>
                <p className="mt-3 text-sm leading-6 text-[#5a6b60]">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <h2 className="text-3xl font-black text-[#132019]">How it works</h2>
        <p className="mt-2 text-[#40564a]">Three steps to your first prediction.</p>
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={staggerContainer}
          className="mt-10 grid gap-6 sm:grid-cols-3"
        >
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
            <motion.div
              key={item.step}
              variants={fadeIn}
              whileHover={{ y: -5, borderColor: "#2d6a4f" }}
              className="rounded-xl border border-[#dce8dd] bg-white p-6 transition-colors duration-300"
            >
              <span className="text-4xl font-black text-[#dce8dd]">{item.step}</span>
              <h3 className="mt-3 text-lg font-bold text-[#132019]">{item.title}</h3>
              <p className="mt-2 text-sm leading-6 text-[#5a6b60]">{item.desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* LMSR EXPLAINER */}
      <section className="bg-[#132019] overflow-hidden">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
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
                ].map((point, idx) => (
                  <motion.li
                    key={point}
                    initial={{ opacity: 0, x: -10 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: idx * 0.1, duration: 0.3 }}
                    className="flex items-start gap-2 text-sm text-[#8aab97]"
                  >
                    <span className="mt-0.5 text-[#40b374]">✓</span>
                    {point}
                  </motion.li>
                ))}
              </ul>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="relative rounded-xl border border-[#2d6a4f] bg-[#0d1610] p-6 shadow-2xl"
            >
              <div className="absolute inset-0 bg-[#40b374]/5 rounded-xl blur-xl animate-pulse pointer-events-none" />

              <p className="text-xs font-mono text-[#40b374] relative z-10">// LMSR pricing formula</p>
              <pre className="mt-3 text-sm font-mono leading-6 text-[#8aab97] overflow-x-auto relative z-10">
                {`cost = b × log(
  eˢʸᵉˢ/ᵇ + eˢⁿᵒ/ᵇ
)

price(YES) = eˢʸᵉˢ/ᵇ / (
  eˢʸᵉˢ/ᵇ + eˢⁿᵒ/ᵇ
)`}
              </pre>
              <p className="mt-4 text-xs text-[#40564a] relative z-10">
                b = liquidity parameter · s = outstanding shares
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <motion.section
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="mx-auto max-w-7xl px-4 py-20 text-center sm:px-6 lg:px-8"
      >
        <h2 className="text-4xl font-black text-[#132019]">
          Start predicting today.
        </h2>
        <p className="mx-auto mt-4 max-w-md text-[#40564a]">
          Markets are live. Prices are updating. Your first trade is one click away.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Link
              href="/landing"
              className="rounded-lg bg-[#2d6a4f] px-8 py-3 text-sm font-bold text-white hover:bg-[#1b4332] transition-colors inline-block"
            >
              Open Markets →
            </Link>
          </motion.div>
        </div>
      </motion.section>

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