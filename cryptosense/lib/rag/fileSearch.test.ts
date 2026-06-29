// @vitest-environment node
import { describe, it, expect, vi, afterEach } from "vitest";
import { searchKnowledgeBase } from "./fileSearch";

afterEach(() => vi.unstubAllEnvs());

describe("searchKnowledgeBase", () => {
  it("maps vector store search results to chunks with source", async () => {
    vi.stubEnv("OPENAI_VECTOR_STORE_ID", "vs_1");
    const client = {
      vectorStores: {
        search: vi.fn().mockResolvedValue({
          data: [
            { filename: "notes.md", content: [{ text: "ETH 解鎖事件" }] },
          ],
        }),
      },
    };
    const r = await searchKnowledgeBase("ETH 風險", client as any);
    expect(r.source).toBe("KnowledgeBase");
    expect(r.data![0]).toEqual({ text: "ETH 解鎖事件", source: "notes.md" });
  });

  it("returns error when vector store id missing", async () => {
    vi.stubEnv("OPENAI_VECTOR_STORE_ID", "");
    const r = await searchKnowledgeBase(
      "x",
      { vectorStores: { search: vi.fn() } } as any,
    );
    expect(r.error).toMatch(/not configured/);
  });

  it("returns error (no fabrication) when search throws", async () => {
    vi.stubEnv("OPENAI_VECTOR_STORE_ID", "vs_1");
    const client = {
      vectorStores: { search: vi.fn().mockRejectedValue(new Error("rate limit")) },
    };
    const r = await searchKnowledgeBase("x", client as any);
    expect(r.data).toBeNull();
    expect(r.error).toMatch(/rate limit/);
  });
});
