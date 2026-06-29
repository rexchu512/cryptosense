// @vitest-environment node
import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/tools/coin", () => ({
  getCoinData: vi.fn().mockResolvedValue({ data: { symbol: "ETH" }, source: "CoinGecko", timestamp: "t" }),
}));
vi.mock("@/lib/tools/news", () => ({
  getCryptoNews: vi.fn().mockResolvedValue({ data: [], source: "CryptoPanic", timestamp: "t" }),
}));
vi.mock("@/lib/rag/fileSearch", () => ({
  searchKnowledgeBase: vi.fn().mockResolvedValue({ data: [{ text: "x", source: "n.md" }], source: "KnowledgeBase", timestamp: "t" }),
}));

import { cryptoTools } from "./tools";

describe("cryptoTools", () => {
  it("exposes exactly 3 tools", () => {
    expect(Object.keys(cryptoTools).sort()).toEqual(["getCoinData", "getCryptoNews", "searchKnowledgeBase"]);
  });

  it("getCoinData.execute returns ToolResult", async () => {
    const r = await (cryptoTools.getCoinData as any).execute({ id: "ethereum" });
    expect(r.data.symbol).toBe("ETH");
  });

  it("getCryptoNews.execute returns ToolResult", async () => {
    const r = await (cryptoTools.getCryptoNews as any).execute({ symbol: "ETH" });
    expect(r.source).toBe("CryptoPanic");
    expect(r.data).toEqual([]);
  });

  it("searchKnowledgeBase.execute returns chunks", async () => {
    const r = await (cryptoTools.searchKnowledgeBase as any).execute({ query: "ETH 風險" });
    expect(r.data[0].source).toBe("n.md");
  });
});
