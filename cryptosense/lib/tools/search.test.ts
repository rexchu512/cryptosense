// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { searchCoins } from "./search";
import { __clearCache } from "./http";

beforeEach(() => __clearCache());
afterEach(() => vi.unstubAllGlobals());

describe("searchCoins", () => {
  it("maps CoinGecko /search results (prefers thumb, falls back to large)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({
      coins: [{ id: "ethereum", symbol: "eth", name: "Ethereum", thumb: "https://x/eth-thumb.png", large: "https://x/eth-large.png" }],
    }) }));
    const r = await searchCoins("eth");
    expect(r.source).toBe("CoinGecko");
    expect(r.data![0]).toEqual({ id: "ethereum", symbol: "ETH", name: "Ethereum", image: "https://x/eth-thumb.png" });
  });
  it("returns an empty list without calling the API for a blank query", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const r = await searchCoins("   ");
    expect(r.data).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("returns fail (no fabrication) when the API errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 429 }));
    const r = await searchCoins("eth");
    expect(r.data).toBeNull();
    expect(r.error).toContain("429");
  });
});
