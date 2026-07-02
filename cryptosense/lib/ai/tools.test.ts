// @vitest-environment node
import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/tools/coin", () => ({ getCoinData: vi.fn().mockResolvedValue({ data: { symbol: "ETH" }, source: "CoinGecko", timestamp: "t" }) }));
vi.mock("@/lib/tools/news", () => ({
  getCryptoNews: async () => ({
    data: [{ title: "ETF 淨流入", url: "https://ct/x", publishedAt: "2026-07-01" }],
    source: "CoinTelegraph", timestamp: "2026-07-02T15:30:00Z",
  }),
}));
const sk = vi.fn().mockResolvedValue({ data: [{ text: "x", source: "n.md" }], source: "KnowledgeBase", timestamp: "t" });
vi.mock("@/lib/rag/fileSearch", () => ({ searchKnowledgeBase: (q: string) => sk(q) }));

import { makeCryptoTools } from "./tools";
import { getCoinData } from "@/lib/tools/coin";
import { createSourceRegistry } from "./sources";

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
    const gen = (tools.searchKnowledgeBase as any).execute({ query: "解鎖風險" });
    await gen.next();
    await gen.next();
    expect(sk).toHaveBeenCalledWith(expect.stringContaining("ETH"));
  });
  it("searchKnowledgeBase yields a searching status before the slow lookup resolves", async () => {
    let resolveLookup!: (v: unknown) => void;
    sk.mockReturnValue(new Promise((resolve) => { resolveLookup = resolve; }));
    const tools = makeCryptoTools({ coinId: "ethereum", symbol: "ETH" });
    const gen = (tools.searchKnowledgeBase as any).execute({ query: "解鎖風險" });

    const first = await gen.next();
    expect(first).toEqual({ value: { status: "searching" }, done: false });

    resolveLookup({ data: [{ text: "x", source: "n.md" }], source: "KnowledgeBase", timestamp: "t" });
    const second = await gen.next();
    expect(second.value).toEqual({
      status: "done",
      data: [{ text: "x", source: "n.md" }],
      source: "KnowledgeBase",
      timestamp: "t",
      sources: [],
    });
  });
});

describe("makeCryptoTools + registry", () => {
  it("news tool registers a numbered source and includes it in output", async () => {
    const reg = createSourceRegistry();
    const tools = makeCryptoTools({ coinId: "bitcoin", symbol: "BTC" }, reg);
    const out: any = await (tools.getCryptoNews as any).execute({}, {});
    expect(out.sources?.[0]?.n).toBe(1);
    expect(out.sources?.[0]?.kind).toBe("news");
    expect(reg.list()[0].url).toBe("https://ct/x");
  });
});
