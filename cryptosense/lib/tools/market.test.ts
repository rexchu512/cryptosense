// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { getMarketOverview, getFearGreedIndex } from "./market";
import { __clearCache } from "./http";
import { __clearRankHistory } from "./market";

beforeEach(() => {
  __clearCache();
  __clearRankHistory();
});

function stubMarkets(coins: any[], global: any) {
  vi.stubGlobal(
    "fetch",
    vi.fn((u: string) =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(String(u).includes("/global") ? global : coins),
      }),
    ),
  );
}

const globalFixture = {
  data: { total_market_cap: { usd: 3.42e12 }, total_volume: { usd: 9.8e10 }, market_cap_percentage: { btc: 54.3 } },
};

describe("getMarketOverview", () => {
  it("maps markets + global, including image/rank/1h/7d", async () => {
    stubMarkets(
      [
        {
          id: "bitcoin", symbol: "btc", name: "Bitcoin",
          image: "https://assets.coingecko.com/coins/images/1/small/bitcoin.png",
          market_cap_rank: 1, current_price: 67200, market_cap: 1.3e12,
          price_change_percentage_24h: 1.2,
          price_change_percentage_1h_in_currency: 0.3,
          price_change_percentage_24h_in_currency: 1.2,
          price_change_percentage_7d_in_currency: 5.0,
          sparkline_in_7d: { price: [1, 2, 3] },
        },
      ],
      globalFixture,
    );
    const r = await getMarketOverview();
    expect(r.source).toBe("CoinGecko");
    expect(r.data!.btcDominance).toBe(54.3);
    expect(r.data!.coins[0]).toMatchObject({
      id: "bitcoin", symbol: "BTC", price: 67200,
      image: "https://assets.coingecko.com/coins/images/1/small/bitcoin.png",
      marketCapRank: 1, change1h: 0.3, change24h: 1.2, change7d: 5.0, spark7d: [1, 2, 3],
    });
    // 呼叫的是同一支 markets API，只是參數多帶 1h,24h,7d
    const marketsCall = (globalThis.fetch as any).mock.calls.find((c: any[]) => !String(c[0]).includes("/global"));
    expect(marketsCall[0]).toContain("price_change_percentage=1h,24h,7d");
  });

  it("returns null rankChange on first sighting, then a direction once rank moves", async () => {
    const coinAt = (rank: number) => [{
      id: "solana", symbol: "sol", name: "Solana", image: "img", market_cap_rank: rank,
      current_price: 172.4, market_cap: 8e10, price_change_percentage_24h: 6.2,
      price_change_percentage_1h_in_currency: 1, price_change_percentage_24h_in_currency: 6.2,
      price_change_percentage_7d_in_currency: 9.8, sparkline_in_7d: { price: [1, 2] },
    }];
    stubMarkets(coinAt(5), globalFixture);
    const first = await getMarketOverview();
    expect(first.data!.coins[0].rankChange).toBeNull();

    __clearCache(); // force a real refetch instead of the 90s in-memory cache hit
    stubMarkets(coinAt(3), globalFixture);
    const second = await getMarketOverview();
    expect(second.data!.coins[0].rankChange).toBe("up"); // rank 5 -> 3 is an improvement
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
