import { describe, it, expect } from "vitest";
import { createSourceRegistry } from "./sources";

describe("source registry", () => {
  it("assigns sequential 1-based n across kinds", () => {
    const r = createSourceRegistry();
    const a = r.add({ kind: "market", title: "BTC 快照", url: "https://x", meta: "CoinGecko" });
    const b = r.add({ kind: "news", title: "ETF", url: "https://y", meta: "CoinTelegraph" });
    const c = r.add({ kind: "kb", title: "note.md", meta: "段落 3" });
    expect([a.n, b.n, c.n]).toEqual([1, 2, 3]);
    expect(r.list().length).toBe(3);
  });
});
