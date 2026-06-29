// @vitest-environment node
import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/tools/coin", () => ({
  getCoinData: vi.fn().mockResolvedValue({ data: { id: "ethereum", symbol: "ETH", name: "Ethereum", price: 3540, change24h: -0.82, marketCap: 1, volume24h: 1, circulatingSupply: 1 }, source: "CoinGecko", timestamp: "t" }),
}));
vi.mock("@/lib/tools/news", () => ({ getCryptoNews: vi.fn().mockResolvedValue({ data: [], source: "CryptoPanic", timestamp: "t" }) }));

import { GET } from "./route";

describe("GET /api/coin/[id]", () => {
  it("returns coin/news bundle", async () => {
    const res = await GET(new Request("http://x/api/coin/ethereum"), { params: Promise.resolve({ id: "ethereum" }) });
    const body = await res.json();
    expect(body.coin.data.symbol).toBe("ETH");
    expect(body.news.data).toEqual([]);
  });
});
