// @vitest-environment node
import { describe, it, expect } from "vitest";
import { MockLanguageModelV4, simulateReadableStream } from "ai/test";
import type { LanguageModelV4StreamPart } from "@ai-sdk/provider";
import { runChat } from "./chat";

describe("runChat", () => {
  it("streams text from injected model", async () => {
    const chunks: LanguageModelV4StreamPart[] = [
      { type: "text-start", id: "t1" },
      { type: "text-delta", id: "t1", delta: "中高風險" },
      { type: "text-end", id: "t1" },
      {
        type: "finish",
        finishReason: { unified: "stop", raw: undefined },
        usage: {
          inputTokens: { total: 1, noCache: undefined, cacheRead: undefined, cacheWrite: undefined },
          outputTokens: { total: 1, text: 1, reasoning: undefined },
        },
      },
    ];

    const model = new MockLanguageModelV4({
      doStream: async () => ({
        stream: simulateReadableStream({ chunks }),
      }),
    });

    const result = await runChat({
      messages: [{ role: "user", id: "m1", parts: [{ type: "text", text: "ETH?" }] }],
      model,
    });

    let text = "";
    for await (const part of result.textStream) text += part;
    expect(text).toContain("中高風險");
  });
});
