// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { getCryptoNews } from "./news";
import { __clearCache } from "./http";

beforeEach(() => __clearCache());

const RSS_XML = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>CoinTelegraph RSS</title>
    <item>
      <title>Bitcoin ETF Approved by SEC</title>
      <link>https://cointelegraph.com/news/btc-etf</link>
      <pubDate>Tue, 30 Jun 2026 07:00:49 +0000</pubDate>
    </item>
    <item>
      <title>Ethereum Merge Anniversary Update</title>
      <link>https://cointelegraph.com/news/eth-merge</link>
      <pubDate>Mon, 29 Jun 2026 12:00:00 +0000</pubDate>
    </item>
  </channel>
</rss>`;

describe("getCryptoNews", () => {
  it("maps title/url/publishedAt from CoinTelegraph RSS, source=CoinTelegraph", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(RSS_XML),
    });
    vi.stubGlobal("fetch", fetchMock);
    const r = await getCryptoNews("BTC");
    expect(r.source).toBe("CoinTelegraph");
    expect(fetchMock.mock.calls[0][0]).toContain("cointelegraph.com/rss");
    expect(r.data![0]).toEqual({
      title: "Bitcoin ETF Approved by SEC",
      url: "https://cointelegraph.com/news/btc-etf",
      publishedAt: "Tue, 30 Jun 2026 07:00:49 +0000",
    });
    expect(r.data![1]).toEqual({
      title: "Ethereum Merge Anniversary Update",
      url: "https://cointelegraph.com/news/eth-merge",
      publishedAt: "Mon, 29 Jun 2026 12:00:00 +0000",
    });
    // 結果無 sentiment 欄位
    expect((r.data![0] as any).sentiment).toBeUndefined();
  });

  it("limits to first 8 items when feed has more", async () => {
    const items = Array.from({ length: 12 }, (_, i) => `
    <item>
      <title>News ${i}</title>
      <link>https://cointelegraph.com/news/${i}</link>
      <pubDate>Tue, 30 Jun 2026 0${i % 10}:00:00 +0000</pubDate>
    </item>`).join("");
    const xml = `<?xml version="1.0"?><rss version="2.0"><channel>${items}</channel></rss>`;
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve(xml) }));
    const r = await getCryptoNews();
    expect(r.data).toHaveLength(8);
  });

  it("handles single-item feed (normalize to array)", async () => {
    const singleItemXml = `<?xml version="1.0"?><rss version="2.0"><channel>
      <item>
        <title>Solo News</title>
        <link>https://cointelegraph.com/news/solo</link>
        <pubDate>Tue, 30 Jun 2026 09:00:00 +0000</pubDate>
      </item>
    </channel></rss>`;
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve(singleItemXml) }));
    const r = await getCryptoNews();
    expect(Array.isArray(r.data)).toBe(true);
    expect(r.data).toHaveLength(1);
    expect(r.data![0].title).toBe("Solo News");
  });

  it("symbol param does not filter (P1 uses global feed)", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve(RSS_XML) });
    vi.stubGlobal("fetch", fetchMock);
    await getCryptoNews("ETH");
    // URL 依然是總體 RSS，不帶 coin 參數
    expect(fetchMock.mock.calls[0][0]).not.toContain("ETH");
  });

  it("returns error result (data null) when fetch fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    const r = await getCryptoNews("ETH");
    expect(r.data).toBeNull();
    expect(r.error).toBeDefined();
    expect(r.source).toBe("CoinTelegraph");
  });
});
