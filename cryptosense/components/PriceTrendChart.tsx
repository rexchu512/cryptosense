"use client";
import { LineChart, Line, ResponsiveContainer } from "recharts";

function trendTitle(symbol: string, change7d: number): string {
  const dir = change7d >= 0 ? "上漲" : "下跌";
  return `${symbol} 7 日${dir} ${Math.abs(change7d).toFixed(1)}%`;
}

export function PriceTrendChart({ symbol, data, change7d }: { symbol: string; data: number[]; change7d: number }) {
  if (data.length < 2) return null;
  const up = change7d >= 0;
  const last = data[data.length - 1];
  return (
    <div className="rounded-2xl border border-hairline p-4">
      <div className="mb-0.5 text-sm font-semibold text-ink">{trendTitle(symbol, change7d)}</div>
      <div className="mb-2 text-[11px] text-cb-muted">來源：CoinGecko · 7D</div>
      <div className="relative h-24">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data.map((v) => ({ v }))} margin={{ top: 4, right: 56, bottom: 4, left: 0 }}>
            <Line type="monotone" dataKey="v" stroke={up ? "#05b169" : "#b3541f"} dot={false} strokeWidth={2} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
        <span className="absolute right-0 top-1/2 -translate-y-1/2 font-mono text-xs text-ink">
          ${last.toLocaleString()}
        </span>
      </div>
    </div>
  );
}
