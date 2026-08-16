// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { getUsdtPairs } from "./binanceSymbols";
import { __clearCache } from "./http";

beforeEach(() => __clearCache());

function stub(symbols: unknown[]) {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ symbols }) }));
}

describe("getUsdtPairs", () => {
  it("keeps only spot pairs that are trading and quoted in USDT", async () => {
    stub([
      { baseAsset: "BTC", quoteAsset: "USDT", status: "TRADING", isSpotTradingAllowed: true },
      { baseAsset: "OLD", quoteAsset: "USDT", status: "BREAK", isSpotTradingAllowed: true },
      { baseAsset: "MARGINONLY", quoteAsset: "USDT", status: "TRADING", isSpotTradingAllowed: false },
      { baseAsset: "ALT", quoteAsset: "BTC", status: "TRADING", isSpotTradingAllowed: true },
    ]);

    const r = await getUsdtPairs();

    expect(r.data?.has("BTC")).toBe(true);
    expect(r.data?.has("OLD")).toBe(false);
    expect(r.data?.has("MARGINONLY")).toBe(false);
    expect(r.data?.has("ALT")).toBe(false);
  });

  it("returns an error rather than an empty set when Binance is unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 503 }));

    const r = await getUsdtPairs();

    expect(r.data).toBeNull();
    expect(r.code).toBe("unavailable");
  });
});
