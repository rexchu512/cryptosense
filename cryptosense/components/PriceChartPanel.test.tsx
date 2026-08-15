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

    // 折線圖可能是因為沒有交易對，也可能是有交易對但價格對不上（撞名）被拒。
    // 文案不該斷言原因，只該說明「沒有日 K，改用收盤價」這個兩種情況都成立的事實。
    expect(await screen.findByText(/無可用日 K 資料/)).toBeInTheDocument();
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

  it("treats a non-ok HTTP response as an outage even when the body has no code field", async () => {
    // 自家路由本身就會這樣：缺 symbol 回 400 {error:"symbol is required"}，沒有 code。
    // CDN/代理層的 429、502 錯誤頁通常也一樣。沒檢查 r.ok 的話，這些會落到
    // 「沒有資料」，把功能壞掉偽裝成「這個幣本來就沒有圖表」。
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: () => Promise.resolve({ error: "symbol is required" }),
    }));

    render(<PriceChartPanel {...props} />);

    expect(await screen.findByText(/暫時無法/)).toBeInTheDocument();
    expect(screen.queryByText(/沒有可用的歷史價格資料/)).not.toBeInTheDocument();
  });

  it("drops the previous coin's readouts when the coin changes, instead of showing them under the new heading", async () => {
    stubJson({ data: { kind: "candles", source: "Binance", pair: "BTCUSDT", points, signals } });

    const { rerender } = render(<PriceChartPanel {...props} />);
    expect(await screen.findByText(/28\.4/)).toBeInTheDocument();

    // 換幣：新的 fetch 故意不 resolve，確認舊幣的指標數字不會殘留到新標題底下。
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
    rerender(<PriceChartPanel {...props} coinId="ethereum" symbol="ETH" />);

    expect(screen.queryByText(/28\.4/)).not.toBeInTheDocument();
    expect(screen.queryByText(/BTCUSDT/)).not.toBeInTheDocument();
  });

  it("never labels an indicator with a trading conclusion", async () => {
    stubJson({ data: { kind: "candles", source: "Binance", pair: "BTCUSDT", points, signals } });

    render(<PriceChartPanel {...props} />);
    await screen.findByTestId("price-chart-canvas");

    // RSI 28.4 很想被寫成「超賣」。把指標翻譯成結論在法遵上等同買賣建議。
    expect(screen.queryByText(/超賣|超買|黃金交叉|死亡交叉/)).not.toBeInTheDocument();
  });
});
