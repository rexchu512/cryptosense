// @vitest-environment node
import { describe, it, expect } from "vitest";
import { MockLanguageModelV4, simulateReadableStream } from "ai/test";
import type { LanguageModelV4StreamPart } from "@ai-sdk/provider";
import { riskCardSchema, buildRiskCardPrompt, streamRiskCard } from "./riskCard";

const valid = {
  stance: "偏高風險" as const,
  confidence: "中" as const,
  headline: "近期資金流出且新聞面偏空，進場前建議確認自身部位規模。",
  pros: [
    { text: "流動性仍集中在主要交易所", sourceId: 1 },
    { text: "生態開發活動未見停滯", sourceId: null },
  ],
  risks: [
    { text: "近 24 小時價格波動放大", sourceId: 2 },
    { text: "同生態近期有大型資安事件", sourceId: 3 },
  ],
};

describe("riskCardSchema", () => {
  it("declares fields in display order so the header paints before the bullets", () => {
    // The object streams key by key; stance/confidence first means the card
    // titles colour in within a few hundred ms instead of after the whole JSON.
    expect(Object.keys(riskCardSchema.shape)).toEqual([
      "stance",
      "confidence",
      "headline",
      "pros",
      "risks",
    ]);
  });

  it("accepts a well-formed card", () => {
    expect(riskCardSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects a stance outside the fixed set", () => {
    // Free text drifts to 「風險偏高」/「較高風險」 and the style switch falls
    // through to its default, silently losing the signal.
    const r = riskCardSchema.safeParse({ ...valid, stance: "風險偏高" });
    expect(r.success).toBe(false);
  });

  it("rejects a confidence outside the fixed set", () => {
    expect(riskCardSchema.safeParse({ ...valid, confidence: "很高" }).success).toBe(false);
  });

  it("requires at least two points on each side", () => {
    expect(riskCardSchema.safeParse({ ...valid, pros: [valid.pros[0]] }).success).toBe(false);
    expect(riskCardSchema.safeParse({ ...valid, risks: [valid.risks[0]] }).success).toBe(false);
  });

  it("caps each side at four points", () => {
    const five = Array.from({ length: 5 }, (_, i) => ({ text: `點 ${i}`, sourceId: null }));
    expect(riskCardSchema.safeParse({ ...valid, pros: five }).success).toBe(false);
  });

  it("exposes no numeric field for the model to fill", () => {
    // Every displayed number comes from the backend. The model can only pick
    // enums and write prose, so it has no slot to hallucinate a figure into.
    const kinds = Object.values(riskCardSchema.shape).map((def) =>
      String((def as unknown as { _def: { type: unknown } })._def.type),
    );
    expect(kinds).not.toContain("number");
  });

  it("takes a source as an integer id, never a URL", () => {
    expect(
      riskCardSchema.safeParse({
        ...valid,
        pros: [{ text: "x", sourceId: "https://example.com" }, valid.pros[1]],
      }).success,
    ).toBe(false);
    expect(
      riskCardSchema.safeParse({
        ...valid,
        pros: [{ text: "x", sourceId: 1.5 }, valid.pros[1]],
      }).success,
    ).toBe(false);
  });

  it("allows a point with no source rather than forcing a fabricated one", () => {
    expect(riskCardSchema.safeParse(valid).success).toBe(true);
    expect(valid.pros.some((p) => p.sourceId === null)).toBe(true);
  });

  it("keeps bullet text short enough to stay qualitative", () => {
    const long = { text: "字".repeat(200), sourceId: null };
    expect(riskCardSchema.safeParse({ ...valid, risks: [long, long] }).success).toBe(false);
  });
});

describe("buildRiskCardPrompt", () => {
  const base = {
    symbol: "ETH",
    coinId: "ethereum",
    question: "現在進場風險高嗎？",
    answer: "以太坊近期波動放大。",
    sources: [
      { n: 1, kind: "market" as const, title: "Ethereum 市場資料快照", meta: "CoinGecko" },
      { n: 2, kind: "news" as const, title: "ETF 淨流出", meta: "CoinTelegraph" },
    ],
  };

  it("names the coin and lists the citable sources with their numbers", () => {
    const p = buildRiskCardPrompt(base);
    expect(p).toContain("ETH");
    expect(p).toContain("[1]");
    expect(p).toContain("Ethereum 市場資料快照");
    expect(p).toContain("[2]");
  });

  it("states the allowed source ids so the model cannot invent one", () => {
    // `s` flag needs es2018; the tsconfig targets ES2017.
    expect(buildRiskCardPrompt(base)).toMatch(/1[\s\S]*2/);
  });

  it("forbids inventing figures without banning numerals outright", () => {
    const p = buildRiskCardPrompt(base);
    expect(p).toMatch(/價格|漲跌|金額/);
    // A blanket "no numbers" rule made the model write 「Layer 二」 in the
    // live probe. Proper nouns that contain a digit must stay allowed.
    expect(p).not.toMatch(/不要寫任何數字/);
  });

  it("ties confidence to how much evidence there is", () => {
    // The live probe returned 信心「高」 on a turn with zero sources, on a
    // card whose own text said the basis was insufficient. Confidence has to
    // be anchored to the evidence, not left to the model's mood.
    const p = buildRiskCardPrompt(base);
    expect(p).toMatch(/信心/);
    expect(p).toMatch(/來源|證據|資料/);
  });

  it("tells the model to report low confidence when nothing was retrieved", () => {
    const p = buildRiskCardPrompt({ ...base, sources: [] });
    expect(p).toMatch(/低/);
  });

  it("forbids introducing facts the analysis never mentioned", () => {
    // The live probe produced 「近期香港行情走弱」 from an answer that never
    // mentioned Hong Kong — and cited a source for it. Bullet prose is free
    // text, so this is the one failure the schema cannot structurally block.
    const p = buildRiskCardPrompt(base);
    expect(p).toMatch(/找得到|沒有提到|不要引入/);
  });

  it("says there are no citable sources when the list is empty", () => {
    const p = buildRiskCardPrompt({ ...base, sources: [] });
    expect(p).toMatch(/沒有|無/);
  });
});

function modelEmitting(json: string) {
  const chunks: LanguageModelV4StreamPart[] = [
    { type: "text-start", id: "t1" },
    { type: "text-delta", id: "t1", delta: json },
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
  return new MockLanguageModelV4({
    doStream: async () => ({ stream: simulateReadableStream({ chunks }) }),
  });
}

const input = {
  symbol: "ETH",
  coinId: "ethereum",
  question: "現在進場風險高嗎？",
  answer: "以太坊近期波動放大。",
  sources: [{ n: 1, kind: "market" as const, title: "快照", meta: "CoinGecko" }],
};

describe("streamRiskCard", () => {
  it("streams a schema-valid card from the model", async () => {
    const r = streamRiskCard({ input, model: modelEmitting(JSON.stringify(valid)) });
    const card = await r.output;
    expect(card.stance).toBe("偏高風險");
    expect(card.pros).toHaveLength(2);
    expect(card.risks[0].sourceId).toBe(2);
  });

  it("exposes partial objects so the header can paint before the bullets land", async () => {
    const r = streamRiskCard({ input, model: modelEmitting(JSON.stringify(valid)) });
    const seen: unknown[] = [];
    for await (const partial of r.partialOutputStream) seen.push(partial);
    expect(seen.length).toBeGreaterThan(0);
  });

  it("rejects rather than returning a malformed card", async () => {
    // A half-formed card is worse than none: the user would read a risk stance
    // that the model never actually committed to.
    const r = streamRiskCard({ input, model: modelEmitting('{"stance":"亂寫"}') });
    await expect(r.output).rejects.toBeTruthy();
  });
});
