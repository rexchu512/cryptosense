"use client";
import { useEffect, useRef } from "react";
import { createChart, CandlestickSeries, LineSeries, type IChartApi, type UTCTimestamp } from "lightweight-charts";
import type { SeriesPoint } from "@/lib/tools/priceSeries";

type MaPoint = { time: number; value: number };

export default function PriceChartCanvas({
  kind, points, ma50, ma200,
}: { kind: "candles" | "line"; points: SeriesPoint[]; ma50: MaPoint[]; ma200: MaPoint[] }) {
  const box = useRef<HTMLDivElement>(null);
  const chart = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!box.current) return;
    const c = createChart(box.current, {
      height: 320,
      layout: { background: { color: "transparent" }, textColor: "#6b7280" },
      grid: { vertLines: { visible: false }, horzLines: { color: "#f1f1f0" } },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false },
    });
    chart.current = c;

    // Binance 的日 K 邊界是 UTC，lightweight-charts 的 UTCTimestamp 是「秒」。
    const sec = (ms: number) => (ms / 1000) as UTCTimestamp;

    if (kind === "candles") {
      c.addSeries(CandlestickSeries, {
        upColor: "#05b169", downColor: "#b3541f",
        borderVisible: false, wickUpColor: "#05b169", wickDownColor: "#b3541f",
      }).setData(points.map((p) => ({
        time: sec(p.time), open: p.open!, high: p.high!, low: p.low!, close: p.close,
      })));
    } else {
      c.addSeries(LineSeries, { color: "#2f6f4e", lineWidth: 2 })
        .setData(points.map((p) => ({ time: sec(p.time), value: p.close })));
    }

    if (ma50.length) {
      c.addSeries(LineSeries, { color: "#c08a3e", lineWidth: 1, priceLineVisible: false })
        .setData(ma50.map((m) => ({ time: sec(m.time), value: m.value })));
    }
    if (ma200.length) {
      c.addSeries(LineSeries, { color: "#7b6ea8", lineWidth: 1, priceLineVisible: false })
        .setData(ma200.map((m) => ({ time: sec(m.time), value: m.value })));
    }

    c.timeScale().fitContent();
    const onResize = () => c.applyOptions({ width: box.current?.clientWidth ?? 0 });
    onResize();
    window.addEventListener("resize", onResize);
    return () => { window.removeEventListener("resize", onResize); c.remove(); };
  }, [kind, points, ma50, ma200]);

  return <div ref={box} className="w-full" data-testid="price-chart-canvas" />;
}
