// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { getCryptoNews } from "./news";
import { __clearCache } from "./http";

beforeEach(() => __clearCache());

describe("getCryptoNews", () => {
  it("maps results and derives sentiment from votes", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ results: [
      { title: "ETF approved", url: "http://a", published_at: "2026-06-18T00:00:00Z", votes: { positive: 10, negative: 1 } },
      { title: "Exchange hacked", url: "http://b", published_at: "2026-06-19T00:00:00Z", votes: { positive: 0, negative: 9 } },
    ] }) });
    vi.stubGlobal("fetch", fetchMock);
    const r = await getCryptoNews("ETH");
    expect(r.source).toBe("CryptoPanic");
    expect(fetchMock.mock.calls[0][0]).toContain("/api/developer/v2/posts/");
    expect(r.data![0].sentiment).toBe("positive");
    expect(r.data![1].sentiment).toBe("negative");
  });
});
