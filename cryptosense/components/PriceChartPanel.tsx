"use client";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import type { PriceSeries } from "@/lib/tools/priceSeries";

// lightweight-charts 需要 DOM，伺服器端渲染會炸。
// next/dynamic 的 ssr:false 在 Server Component 會直接報錯，
// 所以要放在這個 "use client" 元件裡。
const PriceChartCanvas = dynamic(() => import("./PriceChartCanvas"), { ssr: false });

type Props = { coinId: string; symbol: string; spotPrice: number; isStablecoin: boolean };
type State =
  | { s: "loading" }
  | { s: "ready"; series: PriceSeries }
  | { s: "stablecoin" }
  | { s: "nodata" }
  | { s: "outage" };

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-hairline p-4">
      <div className="mb-2 text-sm font-semibold text-ink">{title}</div>
      {children}
    </div>
  );
}

function Readout({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-cb-muted">{label}</div>
      <div className="font-mono text-[13px] text-ink">{value}</div>
    </div>
  );
}

export function PriceChartPanel({ coinId, symbol, spotPrice, isStablecoin }: Props) {
  const [st, setSt] = useState<State>(isStablecoin ? { s: "stablecoin" } : { s: "loading" });

  useEffect(() => {
    if (isStablecoin) return;
    let alive = true;
    const url = `/api/price-series/${coinId}?symbol=${encodeURIComponent(symbol)}` +
      `&spot=${spotPrice}&stable=0`;
    fetch(url)
      .then((r) => r.json())
      .then((j) => {
        if (!alive) return;
        if (j?.data) setSt({ s: "ready", series: j.data });
        // 「這個幣沒有資料」和「服務掛了」必須分開。混在一起的話，
        // 功能壞掉會偽裝成「本來就沒有」，沒有人會發現。
        else setSt({ s: j?.code === "unavailable" ? "outage" : "nodata" });
      })
      .catch(() => alive && setSt({ s: "outage" }));
    return () => { alive = false; };
  }, [coinId, symbol, spotPrice, isStablecoin]);

  if (st.s === "stablecoin") {
    return <Shell title={`${symbol} 走勢`}>
      <p className="text-sm text-cb-muted">穩定幣價格設計上固定，技術指標不適用。</p>
    </Shell>;
  }
  if (st.s === "outage") {
    return <Shell title={`${symbol} 走勢`}>
      <p className="text-sm text-cb-muted">行情資料暫時無法取得，請稍後再試。</p>
    </Shell>;
  }
  if (st.s === "nodata") {
    return <Shell title={`${symbol} 走勢`}>
      <p className="text-sm text-cb-muted">此幣目前沒有可用的歷史價格資料。</p>
    </Shell>;
  }
  if (st.s === "loading") {
    return <Shell title={`${symbol} 走勢`}>
      <div className="h-80 animate-pulse rounded-xl bg-soft" />
    </Shell>;
  }

  const { series } = st;
  const last = series.signals.at(-1);
  const ma = (k: "ma50" | "ma200") =>
    series.signals.flatMap((s) => (s[k] === undefined ? [] : [{ time: s.time, value: s[k]! }]));

  return (
    <Shell title={`${symbol} 90 日走勢`}>
      <div className="mb-2 text-[11px] text-cb-muted">
        來源：{series.source}
        {series.kind === "candles" ? ` · ${series.pair} · 日 K（UTC）` : " · 每日收盤價"}
        {series.kind === "line" && `　此幣在 Binance 無交易對，改用每日收盤價，因此沒有 K 線`}
      </div>
      <PriceChartCanvas kind={series.kind} points={series.points} ma50={ma("ma50")} ma200={ma("ma200")} />
      <div className="mt-3 grid grid-cols-2 gap-3 border-t border-hairline-soft pt-3 sm:grid-cols-4">
        <Readout label="RSI 14" value={last?.rsi14?.toFixed(1) ?? "—"} />
        <Readout label="MACD" value={last?.macd ? `${last.macd.macd.toFixed(2)} / ${last.macd.signal.toFixed(2)}` : "—"} />
        <Readout label="MA50" value={last?.ma50?.toFixed(2) ?? "—"} />
        <Readout label="MA200" value={last?.ma200?.toFixed(2) ?? "—"} />
      </div>
    </Shell>
  );
}
