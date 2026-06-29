// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/tools/coin", () => ({ getCoinData: vi.fn() }));
vi.mock("@/lib/tools/news", () => ({ getCryptoNews: vi.fn() }));

import { GET } from "./route";
import { getCoinData } from "@/lib/tools/coin";
import { getCryptoNews } from "@/lib/tools/news";

const mockCoin = vi.mocked(getCoinData);
const mockNews = vi.mocked(getCryptoNews);

beforeEach(() => {
  mockNews.mockResolvedValue({ data: [], source: "CryptoPanic", timestamp: "t" } as any);
});

describe("GET /api/coin/[id]", () => {
  it("returns coin/news bundle and passes the coin symbol to news", async () => {
    mockCoin.mockResolvedValue({ data: { id: "ethereum", symbol: "ETH", name: "Ethereum", price: 3540, change24h: -0.82, marketCap: 1, volume24h: 1, circulatingSupply: 1 }, source: "CoinGecko", timestamp: "t" } as any);
    const res = await GET(new Request("http://x/api/coin/ethereum"), { params: Promise.resolve({ id: "ethereum" }) });
    const body = await res.json();
    expect(body.coin.data.symbol).toBe("ETH");
    expect(body.news.data).toEqual([]);
    expect(mockNews).toHaveBeenCalledWith("ETH");
  });

  it("stays graceful when coin lookup fails (news called with undefined, valid JSON)", async () => {
    mockCoin.mockResolvedValue({ data: null, source: "CoinGecko", timestamp: "t", error: "HTTP 404" } as any);
    const res = await GET(new Request("http://x/api/coin/nope"), { params: Promise.resolve({ id: "nope" }) });
    const body = await res.json();
    expect(body.coin.data).toBeNull();
    expect(body.coin.error).toContain("404");
    expect(mockNews).toHaveBeenCalledWith(undefined);
  });
});
