// @vitest-environment node
import { describe, it, expect } from "vitest";
import { buildSystemPrompt } from "./prompt";

describe("buildSystemPrompt", () => {
  const p = buildSystemPrompt({ coinId: "ethereum", symbol: "ETH" });
  it("injects current coin", () => expect(p).toContain("ETH"));
  it("covers guardrails", () => {
    for (const s of ["任務範疇", "非投資建議", "external_data", "無法", "買賣"]) {
      expect(p).toContain(s);
    }
  });
});

describe("buildSystemPrompt formatting rules", () => {
  const p = buildSystemPrompt({ coinId: "bitcoin", symbol: "BTC" });
  it("mandates markdown + conclusion-first + [n] citations", () => {
    expect(p).toMatch(/Markdown/);
    expect(p).toMatch(/結論/);
    expect(p).toMatch(/\[n\]/);
  });
  it("contains no pictographic emoji", () => {
    // 常見被用到的 emoji 不得出現
    expect(p).not.toMatch(/[✅⚠📰📚💬]/);
  });
});
