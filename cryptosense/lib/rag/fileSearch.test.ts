// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import { searchKnowledgeBase } from "./fileSearch";

function fakeClient(data: any[]) {
  return { vectorStores: { search: vi.fn().mockResolvedValue({ data }) } } as any;
}

describe("searchKnowledgeBase (vectorStores.search)", () => {
  it("maps content[].text/filename/score and filters by threshold", async () => {
    process.env.OPENAI_VECTOR_STORE_ID = "vs_test";
    const client = fakeClient([
      { file_id: "f1", filename: "a.md", score: 0.9, content: [{ type: "text", text: "hi" }] },
      { file_id: "f2", filename: "b.md", score: 0.1, content: [{ type: "text", text: "lo" }] },
    ]);
    const res = await searchKnowledgeBase("q", client);
    expect(res.source).toBe("KnowledgeBase");
    expect(res.data?.map((c) => c.source)).toContain("a.md");
    // 0.1 < 0.35 門檻應被濾除
    expect(res.data?.every((c) => (c.score ?? 0) >= 0.35)).toBe(true);
  });

  it("returns fail when vector store id missing", async () => {
    delete process.env.OPENAI_VECTOR_STORE_ID;
    const r = await searchKnowledgeBase("x", fakeClient([]));
    expect(r.error).toMatch(/not configured/);
  });

  it("returns fail (no fabrication) when API throws", async () => {
    process.env.OPENAI_VECTOR_STORE_ID = "vs_test";
    const client = { vectorStores: { search: vi.fn().mockRejectedValue(new Error("rate limit")) } } as any;
    const r = await searchKnowledgeBase("x", client);
    expect(r.data).toBeNull();
    expect(r.error).toMatch(/rate limit/);
  });
});
