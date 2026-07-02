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
    <div className="flex items-center justify-between gap-2 border-t border-hairline-soft py-1.5 first:border-t-0">
      <div className="flex items-center gap-2">
        <CoinIcon image={c.image} symbol={c.symbol} size={20} />
        <span className="font-semibold text-cb-muted">{c.symbol}</span>
      </div>
      {c.spark7d.length > 1 && <div className="w-12"><Sparkline data={c.spark7d} up={c.change24h >= 0} /></div>}
      <span className={changeClass(c.change24h)}>{pct(c.change24h)}</span>
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

  const Tile = ({ label, value, sub, subClass = "" }: { label: string; value: ReactNode; sub?: ReactNode; subClass?: string }) => (
    <div className="flex-1 rounded-2xl border border-hairline bg-canvas p-4">
      <div className="text-[10px] uppercase tracking-wide text-cb-muted">{label}</div>
      <div className="text-2xl font-semibold text-ink">{value}</div>
      <div className={`text-sm ${subClass}`}>{sub}</div>
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="flex gap-3">
        <Tile label="恐懼貪婪" value={fearGreed.value} sub={`😐 ${fearGreed.label}`} subClass="text-down-soft" />
        <Tile label="總市值" value={usdCompact(overview.totalMarketCap)} />
        <Tile label="24h 量" value={usdCompact(overview.totalVolume)} />
        <Tile label="BTC 主導" value={`${overview.btcDominance.toFixed(1)}%`} />
      </div>
      <div className="flex gap-3">
        <div data-testid="gainers" className="flex-1 rounded-2xl border border-hairline bg-canvas p-4">
          <div className="text-xs font-medium text-up">▲ 漲幅榜</div>
          {gainers.map((c) => <MoverRow key={c.id} c={c} />)}
        </div>
        <div data-testid="losers" className="flex-1 rounded-2xl border border-hairline bg-canvas p-4">
          <div className="text-xs font-medium text-down-soft">▼ 跌幅榜</div>
          {losers.map((c) => <MoverRow key={c.id} c={c} />)}
        </div>
      </div>
      <div className="rounded-2xl border border-hairline bg-canvas p-4">
        <div className="mb-2 flex items-center justify-between">
          <div className="text-[10px] uppercase tracking-wide text-cb-muted">市值排行</div>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜尋幣種..."
            aria-label="搜尋幣種"
            className="rounded-md border border-hairline px-2 py-1 text-xs text-ink placeholder:text-cb-muted"
          />
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-cb-muted">
              <th className="py-2">#</th><th>幣</th><th className="text-right">價格</th>
              <th className="text-right">1H</th><th className="text-right">24H</th><th className="text-right">7D</th><th>趨勢(7D)</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c, i) => (
              <tr key={c.id} className="border-t border-hairline-soft odd:bg-soft/40 hover:bg-soft">
                <td className="py-2.5 font-mono text-xs text-cb-muted">
                  <RankChange rankChange={c.rankChange} /> {c.marketCapRank || i + 1}
                </td>
                <td>
                  <Link className="flex items-center gap-2 py-1 text-ink hover:underline" href={`/coin/${c.id}`}>
                    <CoinIcon image={c.image} symbol={c.symbol} />
                    <span className="font-semibold">{c.name}</span>
                    <span className="text-cb-muted">{c.symbol}</span>
                  </Link>
                </td>
                <td className="text-right font-mono tabular-nums">${c.price.toLocaleString("en-US")}</td>
                <td data-testid={`change1h-${c.id}`} className={`text-right font-mono tabular-nums ${changeClass(c.change1h)}`}>{pct(c.change1h)}</td>
                <td data-testid={`change-${c.id}`} className={`text-right font-mono tabular-nums ${changeClass(c.change24h)}`}>{pct(c.change24h)}</td>
                <td data-testid={`change7d-${c.id}`} className={`text-right font-mono tabular-nums ${changeClass(c.change7d)}`}>{pct(c.change7d)}</td>
                <td className="w-24">{c.spark7d.length > 1 && <Sparkline data={c.spark7d} up={c.change24h >= 0} />}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <p className="py-6 text-center text-sm text-cb-muted">找不到符合「{query}」的幣種</p>}
      </div>
    </div>
  );
}
