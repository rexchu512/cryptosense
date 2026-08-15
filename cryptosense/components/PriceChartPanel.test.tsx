// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

vi.mock("next/dynamic", () => ({ default: () => () => <div data-testid="price-chart-canvas" /> }));

import { PriceChartPanel } from "./PriceChartPanel";

const props = { coinId: "bitcoin", symbol: "BTC", spotPrice: 67000, isStablecoin: false };

function stubJson(body: unknown) {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(body) }));
}
const points = [{ time: 1, close: 100, open: 99, high: 101, low: 98, volume: 1 }];
const signals = [{ time: 1, rsi14: 28.4, macd: { macd: 1, signal: 0.5, histogram: 0.5 }, ma50: 99, ma200: 98 }];

beforeEach(() => vi.unstubAllGlobals());

describe("PriceChartPanel", () => {
  it("shows the chart and the indicator readouts once data arrives", async () => {
    stubJson({ data: { kind: "candles", source: "Binance", pair: "BTCUSDT", points, signals } });

    render(<PriceChartPanel {...props} />);

    expect(await screen.findByTestId("price-chart-canvas")).toBeInTheDocument();
    expect(screen.getByText(/28\.4/)).toBeInTheDocument();
    expect(screen.getByText(/Binance/)).toBeInTheDocument();
  });

  it("says why a line chart is shown instead of candles", async () => {
    stubJson({ data: { kind: "line", source: "CoinGecko", points: [{ time: 1, close: 100 }], signals } });

    render(<PriceChartPanel {...props} symbol="XMR" />);

    expect(await screen.findByText(/無交易對/)).toBeInTheDocument();
  });

  it("explains that stablecoins are out of scope rather than showing an error", async () => {
    render(<PriceChartPanel {...props} symbol="USDT" isStablecoin />);

    expect(await screen.findByText(/穩定幣/)).toBeInTheDocument();
    expect(screen.queryByText(/暫時無法/)).not.toBeInTheDocument();
  });

  it("distinguishes an outage from a coin that has no data", async () => {
    stubJson({ data: null, code: "unavailable", error: "HTTP 429" });

    render(<PriceChartPanel {...props} />);

    expect(await screen.findByText(/暫時無法/)).toBeInTheDocument();
  });

  it("never labels an indicator with a trading conclusion", async () => {
    stubJson({ data: { kind: "candles", source: "Binance", pair: "BTCUSDT", points, signals } });

    render(<PriceChartPanel {...props} />);
    await screen.findByTestId("price-chart-canvas");

    // RSI 28.4 很想被寫成「超賣」。把指標翻譯成結論在法遵上等同買賣建議。
    expect(screen.queryByText(/超賣|超買|黃金交叉|死亡交叉/)).not.toBeInTheDocument();
  });
});
