// @vitest-environment node
import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/tools/coin", () => ({
  getCoinData: vi.fn().mockResolvedValue({
    data: { id: "ethereum", name: "Ethereum", symbol: "ETH", spark7d: [3600, 3580, 3550] },
    source: "CoinGecko", timestamp: "t",
  }),
}));
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
  it("getCoinData output drops the 7-day sparkline before the model sees it", async () => {
    const tools = makeCryptoTools({ coinId: "ethereum", symbol: "ETH" });
    const out: any = await (tools.getCoinData as any).execute({});
    expect(out.data.symbol).toBe("ETH");
    // 168 floats the model cannot reason over, and they persist in history.
    expect(out.data.spark7d).toBeUndefined();
  });

  it("searchKnowledgeBase leads with the question and trails the coin identifiers", async () => {
    const tools = makeCryptoTools({ coinId: "ethereum", symbol: "ETH" });
    const gen = (tools.searchKnowledgeBase as any).execute({ query: "解鎖風險" });
    await gen.next();
    await gen.next();
    // Order is the point, not mere presence. Prefixing the ticker pulls the
    // embedding toward the small slice of the corpus that names a coin at all,
    // so the question has to come first and the identifiers trail as lexical
    // anchors. `stringContaining("ETH")` passed for both shapes, which is why
    // an earlier revert to the prefixed form went unnoticed.
    expect(sk).toHaveBeenCalledWith("解鎖風險 ETH ethereum");
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
