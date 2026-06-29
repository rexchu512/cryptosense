// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { getMarketOverview, getFearGreedIndex } from "./market";
import { __clearCache } from "./http";

beforeEach(() => __clearCache());

describe("getMarketOverview", () => {
  it("maps markets + global", async () => {
    const markets = [{ id: "bitcoin", symbol: "btc", name: "Bitcoin", current_price: 67200,
      price_change_percentage_24h: 1.2, market_cap: 1.3e12, sparkline_in_7d: { price: [1, 2, 3] } }];
    const global = { data: { total_market_cap: { usd: 3.42e12 }, total_volume: { usd: 9.8e10 }, market_cap_percentage: { btc: 54.3 } } };
    vi.stubGlobal("fetch", vi.fn((u: string) =>
      Promise.resolve({ ok: true, json: () => Promise.resolve(String(u).includes("/global") ? global : markets) })));
    const r = await getMarketOverview();
    expect(r.source).toBe("CoinGecko");
    expect(r.data!.btcDominance).toBe(54.3);
    expect(r.data!.coins[0]).toMatchObject({ id: "bitcoin", symbol: "BTC", price: 67200, change24h: 1.2, spark7d: [1, 2, 3] });
  });
  it("returns error on failure (no stale)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 429 }));
    const r = await getMarketOverview();
    expect(r.data).toBeNull();
    expect(r.error).toContain("429");
  });
});

describe("getFearGreedIndex", () => {
  it("parses string value to number", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true,
      json: () => Promise.resolve({ data: [{ value: "52", value_classification: "Neutral" }] }) }));
    const r = await getFearGreedIndex();
    expect(r.data).toEqual({ value: 52, label: "Neutral" });
  });
});
