// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { getCryptoNews } from "./news";
import { __clearCache } from "./http";

beforeEach(() => __clearCache());

describe("getCryptoNews", () => {
  it("maps all fields and derives sentiment (positive/negative/neutral)", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ results: [
      { title: "ETF approved", url: "http://a", published_at: "2026-06-18T00:00:00Z", votes: { positive: 10, negative: 1 } },
      { title: "Exchange hacked", url: "http://b", published_at: "2026-06-19T00:00:00Z", votes: { positive: 0, negative: 9 } },
      { title: "Routine update", url: "http://c", published_at: "2026-06-20T00:00:00Z", votes: { positive: 3, negative: 3 } },
    ] }) });
    vi.stubGlobal("fetch", fetchMock);
    const r = await getCryptoNews("ETH");
    expect(r.source).toBe("CryptoPanic");
    expect(fetchMock.mock.calls[0][0]).toContain("/api/developer/v2/posts/");
    expect(fetchMock.mock.calls[0][0]).toContain("currencies=ETH");
    // 完整欄位映射（含 publishedAt 來自 published_at）
    expect(r.data![0]).toEqual({ title: "ETF approved", url: "http://a", publishedAt: "2026-06-18T00:00:00Z", sentiment: "positive" });
    expect(r.data![1].sentiment).toBe("negative");
    expect(r.data![2].sentiment).toBe("neutral"); // pos === neg
  });

  it("omits currencies param when no symbol is given", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ results: [] }) });
    vi.stubGlobal("fetch", fetchMock);
    await getCryptoNews();
    expect(fetchMock.mock.calls[0][0]).not.toContain("currencies=");
  });

  it("returns error on failure (data null, no fabrication)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    const r = await getCryptoNews("ETH");
    expect(r.data).toBeNull();
    expect(r.error).toContain("500");
  });
});
