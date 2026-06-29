// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { getCoinData } from "./coin";
import { __clearCache } from "./http";

beforeEach(() => __clearCache());

describe("getCoinData", () => {
  it("maps coin detail", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({
      id: "ethereum", symbol: "eth", name: "Ethereum",
      market_data: { current_price: { usd: 3540 }, price_change_percentage_24h: -0.82,
        market_cap: { usd: 4.25e11 }, total_volume: { usd: 1.8e10 }, circulating_supply: 1.2e8 } }) }));
    const r = await getCoinData("ethereum");
    expect(r.data).toMatchObject({ id: "ethereum", symbol: "ETH", price: 3540, change24h: -0.82, volume24h: 1.8e10 });
  });
  it("returns error on failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 404 }));
    const r = await getCoinData("nope");
    expect(r.data).toBeNull();
    expect(r.error).toContain("404");
  });
});
