// @vitest-environment node
import { describe, it, expect } from "vitest";
import { MockLanguageModelV4 } from "ai/test";
import { buildSuggestions } from "./suggestions";

describe("buildSuggestions", () => {
  it("returns exactly 3 strings from model object output", async () => {
    const model = new MockLanguageModelV4({
      doGenerate: async () => ({
        finishReason: { unified: "stop", raw: "stop" },
        usage: {
          inputTokens: { total: 1, noCache: 1, cacheRead: undefined, cacheWrite: undefined },
          outputTokens: { total: 1, text: 1, reasoning: undefined },
        },
        content: [{ type: "text", text: JSON.stringify({ suggestions: ["ETH 解鎖風險？", "ETH 對比 BTC 抗跌？", "ETH 近期利空？"] }) }],
        warnings: [],
      }),
    });
    const s = await buildSuggestions({ coinId: "ethereum", symbol: "ETH", lastUserText: "ETH?", lastAnswerText: "...", model });
    expect(s).toHaveLength(3);
    expect(s[0]).toContain("ETH");
  });
  it("falls back to 3 defaults on model error", async () => {
    const model = new MockLanguageModelV4({ doGenerate: async () => { throw new Error("boom"); } });
    const s = await buildSuggestions({ symbol: "ETH", model });
    expect(s).toHaveLength(3);
  });
});
