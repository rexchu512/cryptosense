import type { ReactNode } from "react";
import Link from "next/link";
import type { MarketOverview, FearGreed } from "@/lib/tools/market";
import { pct, usdCompact, changeClass } from "@/lib/format";
import { Sparkline } from "./Sparkline";

export function MarketDashboard({ overview, fearGreed }: { overview: MarketOverview; fearGreed: FearGreed }) {
  const sorted = [...overview.coins].sort((a, b) => b.change24h - a.change24h);
  // 依漲跌正負分流，避免幣數少時同一幣同時出現在漲幅榜與跌幅榜
  const gainers = sorted.filter((c) => c.change24h >= 0).slice(0, 3);
  const losers = sorted.filter((c) => c.change24h < 0).slice(-3).reverse();
  const Tile = ({ label, value, sub, subClass = "" }: { label: string; value: ReactNode; sub?: ReactNode; subClass?: string }) => (
    <div className="flex-1 rounded-lg border border-slate-800 bg-slate-900 p-3">
      <div className="text-[10px] uppercase tracking-wide text-slate-400">{label}</div>
      <div className="text-2xl font-bold text-white">{value}</div>
      <div className={`text-sm ${subClass}`}>{sub}</div>
    </div>
  );
  return (
    <div className="space-y-3">
      <div className="flex gap-3">
        <Tile label="恐懼貪婪" value={fearGreed.value} sub={`😐 ${fearGreed.label}`} subClass="text-amber-400" />
        <Tile label="總市值" value={usdCompact(overview.totalMarketCap)} />
        <Tile label="24h 量" value={usdCompact(overview.totalVolume)} />
        <Tile label="BTC 主導" value={`${overview.btcDominance.toFixed(1)}%`} />
      </div>
      <div className="flex gap-3">
        <div data-testid="gainers" className="flex-1 rounded-lg border border-slate-800 bg-slate-900 p-3">
          <div className="text-xs font-medium text-green-500">▲ 漲幅榜</div>
          {gainers.map((c) => <span key={c.id} className="mr-2">{c.symbol} <span className={changeClass(c.change24h)}>{pct(c.change24h)}</span></span>)}
        </div>
        <div data-testid="losers" className="flex-1 rounded-lg border border-slate-800 bg-slate-900 p-3">
          <div className="text-xs font-medium text-red-500">▼ 跌幅榜</div>
          {losers.map((c) => <span key={c.id} className="mr-2">{c.symbol} <span className={changeClass(c.change24h)}>{pct(c.change24h)}</span></span>)}
        </div>
      </div>
      <div className="rounded-lg border border-slate-800 bg-slate-900 p-3">
        <div className="mb-2 text-[10px] uppercase tracking-wide text-slate-400">市值排行</div>
        <table className="w-full text-sm">
          <thead><tr className="text-left text-slate-400"><th>#</th><th>幣</th><th>價格</th><th>24h</th><th>7d</th></tr></thead>
          <tbody>
            {overview.coins.map((c, i) => (
              <tr key={c.id} className="border-t border-slate-800">
                <td>{i + 1}</td>
                <td><Link className="text-sky-400 hover:underline" href={`/coin/${c.id}`}>{c.name}</Link></td>
                <td>${c.price.toLocaleString()}</td>
                <td data-testid={`change-${c.id}`} className={changeClass(c.change24h)}>{pct(c.change24h)}</td>
                <td className="w-24">{c.spark7d.length > 1 && <Sparkline data={c.spark7d} up={c.change24h >= 0} />}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
