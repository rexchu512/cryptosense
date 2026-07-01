// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { getCoinData } from "./coin";
import { __clearCache } from "./http";

beforeEach(() => __clearCache());

describe("getCoinData", () => {
  it("maps coin detail including image/rank/7d change/sparkline", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({
      id: "ethereum", symbol: "eth", name: "Ethereum",
      image: { thumb: "https://x/eth-thumb.png", small: "https://x/eth-small.png", large: "https://x/eth-large.png" },
      market_cap_rank: 2,
      market_data: {
        current_price: { usd: 3540 }, price_change_percentage_24h: -0.82, price_change_percentage_7d: 2.1,
        market_cap: { usd: 4.25e11 }, total_volume: { usd: 1.8e10 }, circulating_supply: 1.2e8,
        sparkline_7d: { price: [10, 9.8, 9.9, 10.1] },
      } }) }));
    const r = await getCoinData("ethereum");
    expect(r.data).toMatchObject({
      id: "ethereum", symbol: "ETH", name: "Ethereum",
      image: "https://x/eth-small.png", marketCapRank: 2,
      price: 3540, change24h: -0.82, change7d: 2.1,
      marketCap: 4.25e11, volume24h: 1.8e10, circulatingSupply: 1.2e8,
      spark7d: [10, 9.8, 9.9, 10.1],
    });
  });
  it("returns error on failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 404 }));
    const r = await getCoinData("nope");
    expect(r.data).toBeNull();
    expect(r.error).toContain("404");
  });
});
