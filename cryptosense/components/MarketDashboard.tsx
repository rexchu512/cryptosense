"use client";
import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import type { MarketOverview, FearGreed } from "@/lib/tools/market";
import { pct, usdCompact, changeClass } from "@/lib/format";
import { Sparkline } from "./Sparkline";
import { CoinIcon } from "./CoinIcon";

type Coin = MarketOverview["coins"][number];

function RankChange({ rankChange }: { rankChange: Coin["rankChange"] }) {
  if (rankChange === "up") return <span role="img" aria-label="排名上升" className="text-up">▲</span>;
  if (rankChange === "down") return <span role="img" aria-label="排名下降" className="text-down-soft">▼</span>;
  return <span role="img" aria-label="排名不變" className="text-cb-muted">–</span>;
}

function MoverRow({ c }: { c: Coin }) {
  return (
    <div className="flex items-center gap-3 border-t border-hairline-soft py-2.5 first:border-t-0">
      <CoinIcon image={c.image} symbol={c.symbol} size={24} />
      <div className="min-w-0 flex-1 truncate text-[13.5px]">
        <span className="font-semibold text-ink">{c.symbol}</span>{" "}
        <span className="text-cb-muted">{c.name}</span>
      </div>
      {c.spark7d.length > 1 && (
        <div className="w-14 shrink-0">
          <Sparkline data={c.spark7d} up={c.change24h >= 0} />
        </div>
      )}
      <span className={`w-[64px] shrink-0 text-right font-mono text-[13px] tabular-nums ${changeClass(c.change24h)}`}>
        {pct(c.change24h)}
      </span>
    </div>
  );
}

function KpiCard({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-hairline bg-canvas p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:p-[17px]">
      <div className="text-[10.5px] uppercase tracking-wide text-cb-muted">{label}</div>
      {children}
    </div>
  );
}

export function MarketDashboard({ overview, fearGreed }: { overview: MarketOverview; fearGreed: FearGreed }) {
  const [query, setQuery] = useState("");
  const sorted = [...overview.coins].sort((a, b) => b.change24h - a.change24h);
  // 依漲跌正負分流，避免幣數少時同一幣同時出現在漲幅榜與跌幅榜
  const gainers = sorted.filter((c) => c.change24h >= 0).slice(0, 3);
  const losers = sorted.filter((c) => c.change24h < 0).slice(-3).reverse();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return overview.coins;
    return overview.coins.filter((c) => c.name.toLowerCase().includes(q) || c.symbol.toLowerCase().includes(q));
  }, [overview.coins, query]);

  return (
    <div className="cs-wrap py-10 sm:py-14">
      {/* Hero */}
      <div className="pb-7 sm:pb-9">
        <span className="cs-eyebrow">Market Pulse · 市場總覽</span>
        <h1 className="cs-head mt-3 max-w-[20ch] text-[clamp(28px,4vw,46px)] leading-[1.08] text-ink">
          冷靜讀懂今天的市場
        </h1>
        <p className="mt-3 max-w-[52ch] text-[15px] leading-relaxed text-body sm:text-[17px]">
          整合即時行情、市場情緒與新聞的分析視角。看清風險與盲點，而不是追高與製造焦慮。
        </p>
      </div>

      {/* KPI tiles */}
      <div className="mb-7 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="恐懼貪婪指數">
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="font-mono text-[26px] font-semibold tabular-nums text-ink">{fearGreed.value}</span>
            <span className="text-sm font-medium text-down-soft">{fearGreed.label}</span>
          </div>
          <div
            className="relative mt-3 h-[7px] rounded-full"
            style={{ background: "linear-gradient(90deg, var(--up), var(--down-soft) 50%, var(--down))" }}
          >
            <span
              className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-down-soft bg-canvas shadow"
              style={{ left: `${Math.min(100, Math.max(0, fearGreed.value))}%` }}
            />
          </div>
        </KpiCard>

        <KpiCard label="總市值">
          <div className="mt-1.5 font-mono text-[26px] font-semibold tabular-nums text-ink">
            {usdCompact(overview.totalMarketCap)}
          </div>
        </KpiCard>

        <KpiCard label="24H 成交量">
          <div className="mt-1.5 font-mono text-[26px] font-semibold tabular-nums text-ink">
            {usdCompact(overview.totalVolume)}
          </div>
        </KpiCard>

        <KpiCard label="BTC 主導度">
          <div className="mt-1.5 font-mono text-[26px] font-semibold tabular-nums text-ink">
            {`${overview.btcDominance.toFixed(1)}%`}
          </div>
          <div className="mt-3 h-[7px] overflow-hidden rounded-full bg-soft">
            <div
              className="h-full rounded-full bg-indigo"
              style={{ width: `${Math.min(100, Math.max(0, overview.btcDominance))}%` }}
            />
          </div>
        </KpiCard>
      </div>

      {/* Gainers / losers */}
      <div className="mb-7 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div
          data-testid="gainers"
          className="rounded-2xl border border-hairline bg-canvas p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:p-[17px]"
        >
          <h3 className="flex items-center gap-1.5 text-[13px] font-bold text-ink">
            <span className="text-up">▲</span> 漲幅榜
          </h3>
          {gainers.map((c) => <MoverRow key={c.id} c={c} />)}
        </div>
        <div
          data-testid="losers"
          className="rounded-2xl border border-hairline bg-canvas p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:p-[17px]"
        >
          <h3 className="flex items-center gap-1.5 text-[13px] font-bold text-ink">
            <span className="text-down-soft">▼</span> 跌幅榜
          </h3>
          {losers.map((c) => <MoverRow key={c.id} c={c} />)}
        </div>
      </div>

      {/* Ranking table */}
      <div className="mb-10 overflow-hidden rounded-2xl border border-hairline bg-canvas shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 p-4">
          <span className="cs-eyebrow text-[11px]">市值排行</span>
          <div className="relative w-full max-w-[220px]">
            <svg
              className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-cb-muted"
              viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            >
              <circle cx="11" cy="11" r="7" /><path d="m21 21-4-4" />
            </svg>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜尋幣種..."
              aria-label="搜尋幣種"
              className="w-full rounded-lg border border-hairline bg-canvas py-1.5 pl-8 pr-3 text-xs text-ink placeholder:text-cb-muted focus:border-glow focus:outline-none"
            />
          </div>
        </div>

        {/* Desktop / tablet table */}
        <div data-testid="mkt-desktop" className="hidden overflow-x-auto md:block">
          <table className="w-full text-[13.5px]">
            <thead className="sticky top-0 z-10 bg-canvas">
              <tr className="border-b border-hairline text-left text-[11px] font-semibold uppercase tracking-wide text-cb-muted">
                <th className="px-3 py-3">#</th>
                <th className="px-3 py-3">幣種</th>
                <th className="px-3 py-3 text-right">價格</th>
                <th className="px-3 py-3 text-right">1H</th>
                <th className="px-3 py-3 text-right">24H</th>
                <th className="px-3 py-3 text-right">7D</th>
                <th className="px-3 py-3 text-right">市值</th>
                <th className="px-3 py-3 text-right">趨勢 7D</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c, i) => (
                <tr key={c.id} className="border-t border-hairline-soft odd:bg-soft/40 hover:bg-soft">
                  <td className="px-3 py-3 font-mono text-xs text-cb-muted">
                    <RankChange rankChange={c.rankChange} /> {c.marketCapRank || i + 1}
                  </td>
                  <td className="px-3 py-3">
                    <Link className="flex items-center gap-2.5 text-ink hover:underline" href={`/coin/${c.id}`}>
                      <CoinIcon image={c.image} symbol={c.symbol} size={26} />
                      <span className="font-semibold">{c.name}</span>
                      <span className="text-cb-muted">{c.symbol}</span>
                    </Link>
                  </td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums text-ink">${c.price.toLocaleString("en-US")}</td>
                  <td data-testid={`change1h-${c.id}`} className={`px-3 py-3 text-right font-mono tabular-nums ${changeClass(c.change1h)}`}>{pct(c.change1h)}</td>
                  <td data-testid={`change-${c.id}`} className={`px-3 py-3 text-right font-mono tabular-nums ${changeClass(c.change24h)}`}>{pct(c.change24h)}</td>
                  <td data-testid={`change7d-${c.id}`} className={`px-3 py-3 text-right font-mono tabular-nums ${changeClass(c.change7d)}`}>{pct(c.change7d)}</td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums text-ink">{usdCompact(c.marketCap)}</td>
                  <td className="w-24 px-3 py-3">{c.spark7d.length > 1 && <Sparkline data={c.spark7d} up={c.change24h >= 0} />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile card list */}
        <div data-testid="mkt-mobile" className="divide-y divide-hairline-soft md:hidden">
          {filtered.map((c, i) => (
            <Link key={c.id} href={`/coin/${c.id}`} className="flex items-center gap-3 p-3 hover:bg-soft">
              <CoinIcon image={c.image} symbol={c.symbol} size={32} />
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold text-ink">{c.name}</div>
                <div className="font-mono text-[11.5px] text-cb-muted">#{c.marketCapRank || i + 1} · {c.symbol}</div>
              </div>
              {c.spark7d.length > 1 && (
                <div className="w-12 shrink-0">
                  <Sparkline data={c.spark7d} up={c.change24h >= 0} />
                </div>
              )}
              <div className="shrink-0 text-right">
                <div className="font-mono text-sm font-semibold tabular-nums text-ink">${c.price.toLocaleString("en-US")}</div>
                <div className={`font-mono text-xs tabular-nums ${changeClass(c.change24h)}`}>{pct(c.change24h)}</div>
              </div>
            </Link>
          ))}
        </div>

        {filtered.length === 0 && <p className="py-8 text-center text-sm text-cb-muted">找不到符合「{query}」的幣種</p>}
      </div>
    </div>
  );
}
