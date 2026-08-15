// @vitest-environment node
import { describe, it, expect } from "vitest";
import { translateTechnique, translateClassification } from "./incidentTerms";

describe("translateTechnique", () => {
  it("translates the techniques that dominate the dataset", () => {
    // These four alone account for the majority of recorded incidents.
    expect(translateTechnique("Private Key Compromised")).toBe("私鑰遭盜用");
    expect(translateTechnique("Access Control Exploit")).toBe("權限控管漏洞");
    expect(translateTechnique("Flashloan Price Oracle Attack")).toBe("閃電貸價格預言機攻擊");
    expect(translateTechnique("Reentrancy")).toBe("重入攻擊");
  });

  it("is not case-sensitive and tolerates extra spacing", () => {
    expect(translateTechnique("  private key compromised ")).toBe("私鑰遭盜用");
  });

  it("falls back to term-by-term translation for names it has no entry for", () => {
    // 262 distinct techniques exist and the tail is long, so unseen names must
    // still come out mostly readable rather than staying wholly English.
    const out = translateTechnique("Flashloan Vault Exploit");
    expect(out).toContain("閃電貸");
    expect(out).toContain("漏洞");
    expect(out).not.toContain("Flashloan");
  });

  it("keeps untranslatable proper nouns instead of mangling them", () => {
    // "Safe" and "Multisig" name a specific product; dropping them would lose
    // the only identifying information in the phrase.
    const out = translateTechnique("Safe Multisig wallet Phishing Exploit");
    expect(out).toContain("釣魚");
    expect(out).toContain("Safe");
  });

  it("returns a readable label for unknown or missing input", () => {
    expect(translateTechnique("Unknown")).toBe("手法不明");
    expect(translateTechnique("")).toBe("手法不明");
    expect(translateTechnique(undefined)).toBe("手法不明");
  });

  it("never returns an empty string", () => {
    for (const t of ["", "   ", "???", "Zzz Qqq"]) {
      expect(translateTechnique(t).length).toBeGreaterThan(0);
    }
  });
});

describe("translateClassification", () => {
  it("translates every classification the dataset uses", () => {
    expect(translateClassification("Protocol Logic")).toBe("協議邏輯漏洞");
    expect(translateClassification("Infrastructure")).toBe("基礎設施");
    expect(translateClassification("Ecosystem")).toBe("生態系");
    expect(translateClassification("Rugpull")).toBe("捲款跑路");
    expect(translateClassification("Smart Contract Language")).toBe("智慧合約語言");
  });

  it("falls back to a readable label rather than blank", () => {
    expect(translateClassification(undefined)).toBe("分類不明");
    expect(translateClassification("Something New")).toBe("Something New");
  });
});
