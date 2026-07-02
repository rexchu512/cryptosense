import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SourceTray } from "./SourceTray";
import type { CitedSource } from "@/lib/ai/sources";

const sources: CitedSource[] = [
  { n: 1, kind: "kb", title: "note.md", meta: "個人筆記 · 相似度 0.82", snippet: "波動度偏低時追高邊際報酬有限。" },
  { n: 2, kind: "news", title: "ETF 淨流入", url: "https://ct/x", meta: "CoinTelegraph · 2026/07/01" },
  {
    n: 3,
    kind: "market",
    title: "BTC 快照",
    url: "https://www.coingecko.com/en/coins/bitcoin",
    meta: "CoinGecko · Powered by CoinGecko API",
  },
];

describe("SourceTray", () => {
  it("renders each source with its number; url sources become external links", () => {
    render(<SourceTray sources={sources} />);
    expect(screen.getByText("note.md")).toBeTruthy();
    const links = screen.getAllByRole("link");
    expect(links.some((a) => a.getAttribute("href") === "https://ct/x")).toBe(true);
    // kb source has no url → expandable "展開片段" with the retrieved chunk
    expect(screen.getByText("展開片段")).toBeTruthy();
    expect(screen.getByText(/波動度偏低時追高/)).toBeTruthy();
    // rows carry #cs-{n} anchors so inline [n] links can jump to them
    expect(document.getElementById("cs-2")).not.toBeNull();
    // CoinGecko attribution (free-API compliance) must be visible
    expect(screen.getByText(/Powered by CoinGecko API/)).toBeTruthy();
  });

  it("returns null when there are no sources", () => {
    const { container } = render(<SourceTray sources={[]} />);
    expect(container.firstChild).toBeNull();
  });
});
