// @vitest-environment node
import { describe, it, expect, vi, afterEach } from "vitest";
import { searchKnowledgeBase } from "./fileSearch";

afterEach(() => vi.unstubAllEnvs());

const respWithResults = {
  output: [
    { type: "file_search_call", status: "completed",
      results: [
        { filename: "eth-notes.md", score: 0.91, content: [{ type: "text", text: "ETH 解鎖事件提醒" }] },
      ] },
    { type: "message", role: "assistant", content: [{ type: "output_text", text: "...", annotations: [] }] },
  ],
};

describe("searchKnowledgeBase (Responses API)", () => {
  it("maps file_search_call.results to chunks", async () => {
    vi.stubEnv("OPENAI_VECTOR_STORE_ID", "vs_1");
    const client = { responses: { create: vi.fn().mockResolvedValue(respWithResults) } };
    const r = await searchKnowledgeBase("ETH 風險", client as any);
    expect(r.source).toBe("KnowledgeBase");
    expect(r.data![0]).toEqual({ text: "ETH 解鎖事件提醒", source: "eth-notes.md", score: 0.91 });
    // 必須帶 file_search tool + include results
    const arg = (client.responses.create as any).mock.calls[0][0];
    expect(arg.tools[0].type).toBe("file_search");
    expect(arg.tools[0].vector_store_ids).toEqual(["vs_1"]);
    expect(arg.include).toContain("file_search_call.results");
  });
  it("returns fail when vector store id missing", async () => {
    vi.stubEnv("OPENAI_VECTOR_STORE_ID", "");
    const r = await searchKnowledgeBase("x", { responses: { create: vi.fn() } } as any);
    expect(r.error).toMatch(/not configured/);
  });
  it("returns fail (no fabrication) when API throws", async () => {
    vi.stubEnv("OPENAI_VECTOR_STORE_ID", "vs_1");
    const client = { responses: { create: vi.fn().mockRejectedValue(new Error("rate limit")) } };
    const r = await searchKnowledgeBase("x", client as any);
    expect(r.data).toBeNull();
    expect(r.error).toMatch(/rate limit/);
  });
});
