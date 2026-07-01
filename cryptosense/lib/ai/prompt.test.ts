// @vitest-environment node
import { describe, it, expect } from "vitest";
import { buildSystemPrompt } from "./prompt";

describe("buildSystemPrompt", () => {
  const p = buildSystemPrompt({ coinId: "ethereum", symbol: "ETH" });
  it("injects current coin", () => expect(p).toContain("ETH"));
  it("covers guardrails", () => {
    for (const s of ["任務範疇", "非投資建議", "external_data", "無法", "買進", "賣出"]) {
      expect(p).toContain(s);
    }
  });
});
