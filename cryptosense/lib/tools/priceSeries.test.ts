// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./binanceSymbols", () => ({ getUsdtPairs: vi.fn() }));
vi.mock("./ohlcv", () => ({ getOHLCV: vi.fn() }));
vi.mock("./cgSeries", () => ({ getDailyCloses: vi.fn() }));

import { getPriceSeries } from "./priceSeries";
import { getUsdtPairs } from "./binanceSymbols";
import { getOHLCV } from "./ohlcv";
import { getDailyCloses } from "./cgSeries";

const mockPairs = vi.mocked(getUsdtPairs);
const mockOHLCV = vi.mocked(getOHLCV);
const mockCG = vi.mocked(getDailyCloses);

const DAY = 86_400_000;
const T0 = Date.UTC(2025, 0, 1);

function candles(n: number, price = 100) {
  return Array.from({ length: n }, (_, i) => ({
    time: T0 + i * DAY, open: price, high: price + 1, low: price - 1, close: price, volume: 1,
  }));
}
function closes(n: number, price = 100) {
  return Array.from({ length: n }, (_, i) => ({ time: T0 + i * DAY, close: price }));
}
const base = { coinId: "bitcoin", symbol: "BTC", spotPrice: 100, isStablecoin: false };

beforeEach(() => {
  // 本專案 vitest.config.ts 的 restoreMocks 只會還原 vi.spyOn 建立的 mock；
  // 這裡的 vi.fn() 是從 vi.mock 工廠回傳的一般 mock，呼叫紀錄不會自動清空，
  // 導致後面「stablecoin 不應呼叫上游」的斷言被前面測試的呼叫次數污染。
  // 手動清空，讓每個測試從乾淨的呼叫狀態開始。
  vi.clearAllMocks();
  mockPairs.mockResolvedValue({ data: new Set(["BTC"]), source: "Binance", timestamp: "t" } as any);
  mockOHLCV.mockResolvedValue({ data: { pair: "BTCUSDT", candles: candles(250) }, source: "Binance", timestamp: "t" } as any);
  mockCG.mockResolvedValue({ data: closes(250), source: "CoinGecko", timestamp: "t" } as any);
});

describe("getPriceSeries", () => {
  it("uses Binance candles when the pair exists and the price agrees", async () => {
    const r = await getPriceSeries(base);

    expect(r.data?.kind).toBe("candles");
    expect(r.data?.source).toBe("Binance");
    expect(r.data?.pair).toBe("BTCUSDT");
  });

  it("shows only the last 90 points while computing indicators over the full history", async () => {
    const r = await getPriceSeries(base);

    expect(r.data?.points).toHaveLength(90);
    expect(r.data?.signals).toHaveLength(90);
    // MA200 需要 200 根。若指標只用顯示視窗的 90 根計算，這裡會是 undefined。
    expect(r.data?.signals.at(-1)?.ma200).toBeDefined();
    // 指標必須與顯示點逐筆對齊
    expect(r.data?.signals.map((s) => s.time)).toEqual(r.data?.points.map((p) => p.time));
  });

  it("falls back to the line series when Binance's price disagrees with the spot price", async () => {
    // 代號撞名：Binance 的 BTCUSDT 是比特幣，但這個幣現價只有 0.5 美元
    const r = await getPriceSeries({ ...base, spotPrice: 0.5 });

    expect(r.data?.kind).toBe("line");
    expect(r.data?.source).toBe("CoinGecko");
  });

  it("uses the line series when the coin has no Binance pair", async () => {
    mockPairs.mockResolvedValue({ data: new Set<string>(), source: "Binance", timestamp: "t" } as any);

    const r = await getPriceSeries({ ...base, symbol: "XMR" });

    expect(r.data?.kind).toBe("line");
    expect(r.data?.signals.at(-1)?.rsi14).toBeDefined();
  });

  it("refuses stablecoins before spending any upstream request", async () => {
    const r = await getPriceSeries({ ...base, symbol: "USDT", isStablecoin: true });

    expect(r.data).toBeNull();
    expect(r.code).toBe("unlisted");
    expect(mockPairs).not.toHaveBeenCalled();
    expect(mockCG).not.toHaveBeenCalled();
  });

  it("separates an upstream outage from a coin that simply has no data", async () => {
    mockPairs.mockResolvedValue({ data: new Set<string>(), source: "Binance", timestamp: "t" } as any);
    mockCG.mockResolvedValue({ data: null, source: "CoinGecko", timestamp: "t", error: "HTTP 429", code: "unavailable" } as any);

    const r = await getPriceSeries({ ...base, symbol: "XMR" });

    expect(r.data).toBeNull();
    expect(r.code).toBe("unavailable");
  });
});
