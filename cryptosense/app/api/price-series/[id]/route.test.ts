// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/tools/priceSeries", () => ({ getPriceSeries: vi.fn() }));

import { GET } from "./route";
import { getPriceSeries } from "@/lib/tools/priceSeries";

const mockSeries = vi.mocked(getPriceSeries);

beforeEach(() => {
  // 本專案 vitest.config.ts 的 restoreMocks 只會還原 vi.spyOn 建立的 mock；
  // 這裡的 vi.fn() 是從 vi.mock 工廠回傳的一般 mock，呼叫紀錄不會自動清空，
  // 會污染後面「缺 symbol 不應呼叫 getPriceSeries」的斷言。手動清空。
  mockSeries.mockClear();
  mockSeries.mockResolvedValue({
    data: { kind: "candles", source: "Binance", pair: "BTCUSDT", points: [], signals: [] },
    source: "Binance", timestamp: "t",
  } as any);
});

function call(url: string, id = "bitcoin") {
  return GET(new Request(url), { params: Promise.resolve({ id }) });
}

describe("GET /api/price-series/[id]", () => {
  it("passes the coin id and query parameters through to the series builder", async () => {
    const res = await call("http://x/api/price-series/bitcoin?symbol=BTC&spot=67000&stable=0");
    const body = await res.json();

    expect(mockSeries).toHaveBeenCalledWith({
      coinId: "bitcoin", symbol: "BTC", spotPrice: 67000, isStablecoin: false,
    });
    expect(body.data.kind).toBe("candles");
  });

  it("reads stable=1 as a stablecoin", async () => {
    await call("http://x/api/price-series/tether?symbol=USDT&spot=1&stable=1", "tether");

    expect(mockSeries).toHaveBeenCalledWith(
      expect.objectContaining({ isStablecoin: true }),
    );
  });

  it("returns 400 when the symbol is missing instead of guessing one", async () => {
    const res = await call("http://x/api/price-series/bitcoin?spot=67000");

    expect(res.status).toBe(400);
    expect(mockSeries).not.toHaveBeenCalled();
  });
});
