// @vitest-environment node
import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/tools/coin", () => ({ getCoinData: vi.fn().mockResolvedValue({ data: { symbol: "ETH" }, source: "CoinGecko", timestamp: "t" }) }));
vi.mock("@/lib/tools/news", () => ({ getCryptoNews: vi.fn().mockResolvedValue({ data: [], source: "CoinTelegraph", timestamp: "t" }) }));
const sk = vi.fn().mockResolvedValue({ data: [{ text: "x", source: "n.md" }], source: "KnowledgeBase", timestamp: "t" });
vi.mock("@/lib/rag/fileSearch", () => ({ searchKnowledgeBase: (q: string) => sk(q) }));

import { makeCryptoTools } from "./tools";
import { getCoinData } from "@/lib/tools/coin";

describe("makeCryptoTools", () => {
  it("exposes exactly 3 tools", () => {
    expect(Object.keys(makeCryptoTools({ coinId: "ethereum", symbol: "ETH" })).sort())
      .toEqual(["getCoinData", "getCryptoNews", "searchKnowledgeBase"]);
  });
  it("getCoinData defaults to current coin when id omitted", async () => {
    const tools = makeCryptoTools({ coinId: "ethereum", symbol: "ETH" });
    await (tools.getCoinData as any).execute({});
    expect(getCoinData).toHaveBeenCalledWith("ethereum");
  });
  it("searchKnowledgeBase prefixes the current symbol", async () => {
    const tools = makeCryptoTools({ coinId: "ethereum", symbol: "ETH" });
    await (tools.searchKnowledgeBase as any).execute({ query: "解鎖風險" });
    expect(sk).toHaveBeenCalledWith(expect.stringContaining("ETH"));
  });
});
