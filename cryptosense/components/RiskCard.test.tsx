import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { RiskCard } from "./RiskCard";
import type { CitedSource } from "@/lib/ai/sources";

const sources: CitedSource[] = [
  { n: 1, kind: "market", title: "Ethereum 市場資料快照", meta: "CoinGecko", url: "https://cg/eth" },
  { n: 2, kind: "news", title: "ETF 淨流出", meta: "CoinTelegraph", url: "https://ct/x" },
];

const full = {
  stance: "偏高風險",
  confidence: "中",
  headline: "波動放大，進場前先確認部位規模。",
  pros: [
    { text: "流動性仍集中在主要交易所", sourceId: 1 },
    { text: "生態開發活動未見停滯", sourceId: null },
  ],
  risks: [
    { text: "近 24 小時波動放大", sourceId: 2 },
    { text: "同生態近期有大型資安事件", sourceId: null },
  ],
};

const incidents = {
  scope: "chain" as const,
  label: "Ethereum",
  count: 273,
  totalLossUsd: 3_000_000_000,
  largest: {
    name: "Bybit",
    date: "2025-02-21",
    lossUsd: 1_400_000_000,
    technique: "Private Key Compromised",
  },
  latest: { name: "Some Protocol", date: "2026-07-01", lossUsd: 1_000_000 },
  topTechniques: [{ technique: "Private Key Compromised", count: 45 }],
};

describe("RiskCard", () => {
  it("renders nothing before anything has arrived", () => {
    const { container } = render(
      <RiskCard card={null} incidents={null} sources={[]} status="streaming" />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("paints the stance and confidence before the bullets exist", () => {
    // The object streams key by key, so this is the real intermediate state —
    // the header must be usable on its own.
    render(
      <RiskCard
        card={{ stance: "偏高風險", confidence: "中" }}
        incidents={null}
        sources={sources}
        status="streaming"
      />,
    );
    expect(screen.getByText("偏高風險")).toBeInTheDocument();
    expect(screen.getByText(/信心.*中/)).toBeInTheDocument();
  });

  it("renders the full card once complete", () => {
    render(<RiskCard card={full} incidents={null} sources={sources} status="done" />);
    expect(screen.getByText(full.headline)).toBeInTheDocument();
    expect(screen.getByText("流動性仍集中在主要交易所")).toBeInTheDocument();
    expect(screen.getByText("近 24 小時波動放大")).toBeInTheDocument();
  });

  it("skips a bullet that has not finished streaming", () => {
    // Half-written bullets make the card jitter and can read as a claim the
    // model never finished making.
    render(
      <RiskCard
        card={{ ...full, pros: [{ text: "流動性仍集中在主要交易所", sourceId: 1 }, { text: "" }] }}
        incidents={null}
        sources={sources}
        status="streaming"
      />,
    );
    expect(screen.getByText("流動性仍集中在主要交易所")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem").length).toBeGreaterThan(0);
  });

  it("links a bullet to its cited source", () => {
    render(<RiskCard card={full} incidents={null} sources={sources} status="done" />);
    const link = screen.getByRole("link", { name: /\[1\]/ });
    expect(link).toHaveAttribute("href", "#cs-1");
  });

  it("puts the citation at the head of the bullet so it cannot be orphaned", () => {
    // Chinese wraps between any two characters, so a trailing [n] regularly
    // landed alone on the next line. Leading it also replaces the dot.
    render(<RiskCard card={full} incidents={null} sources={sources} status="done" />);
    const item = screen.getByText("流動性仍集中在主要交易所").closest("li")!;
    expect(item.textContent!.trim().startsWith("[1]")).toBe(true);
  });

  it("shows a plain marker when a bullet cites nothing", () => {
    render(<RiskCard card={full} incidents={null} sources={sources} status="done" />);
    const item = screen.getByText("生態開發活動未見停滯").closest("li")!;
    expect(item.querySelector("a")).toBeNull();
    expect(item.textContent).toContain("·");
  });

  it("does not shout the chain name in the incident heading", () => {
    // "Ethereum" is a proper noun; the uppercase treatment that suits the
    // Chinese section labels renders it as ETHEREUM.
    render(<RiskCard card={full} incidents={incidents} sources={sources} status="done" />);
    const heading = screen.getByText(/資安紀錄/);
    expect(heading.className).not.toMatch(/\buppercase\b/);
  });

  it("shows no link when the cited id matches no source", () => {
    render(
      <RiskCard
        card={{ ...full, pros: [{ text: "無效引用", sourceId: 99 }, full.pros[1]] }}
        incidents={null}
        sources={sources}
        status="done"
      />,
    );
    expect(screen.getByText("無效引用")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /\[99\]/ })).toBeNull();
  });

  it("shows the incident block with count and largest loss", () => {
    render(<RiskCard card={full} incidents={incidents} sources={sources} status="done" />);
    expect(screen.getByText(/273/)).toBeInTheDocument();
    expect(screen.getByText(/\$1\.4B/)).toBeInTheDocument();
    expect(screen.getByText(/Bybit/)).toBeInTheDocument();
  });

  it("spaces a Latin technique name off the Chinese, but not a Chinese one", () => {
    const latin = {
      ...incidents,
      largest: { ...incidents.largest, technique: "Safe Multisig wallet Phishing Exploit" },
    };
    render(<RiskCard card={full} incidents={latin} sources={sources} status="done" />);
    expect(screen.getByText(/手法為 Safe/)).toBeInTheDocument();
  });

  it("does not space a technique that starts in Chinese", () => {
    render(<RiskCard card={full} incidents={incidents} sources={sources} status="done" />);
    expect(screen.getByText(/手法為私鑰遭盜用/)).toBeInTheDocument();
  });

  it("shows attack techniques in Chinese, not English jargon", () => {
    // The audience is Chinese-speaking retail investors; "Private Key
    // Compromised" leaves the card's most differentiated section unreadable.
    render(<RiskCard card={full} incidents={incidents} sources={sources} status="done" />);
    // Appears twice: once in the largest-incident sentence, once in the
    // common-techniques line.
    expect(screen.getAllByText(/私鑰遭盜用/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Private Key Compromised/)).toBeNull();
  });

  it("hides the incident block entirely when there is no data", () => {
    // Absence of a record is not a claim of safety, so the section disappears
    // rather than reporting zero.
    render(<RiskCard card={full} incidents={null} sources={sources} status="done" />);
    expect(screen.queryByText(/資安紀錄/)).toBeNull();
    expect(screen.queryByText(/0 起/)).toBeNull();
  });

  it("renders nothing at all when generation failed", () => {
    const { container } = render(
      <RiskCard card={full} incidents={incidents} sources={sources} status="error" />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("still renders a stance value it does not recognise", () => {
    // Enum drift must degrade to plain text, never to a blank header.
    render(
      <RiskCard
        card={{ ...full, stance: "風險偏高" }}
        incidents={null}
        sources={sources}
        status="done"
      />,
    );
    expect(screen.getByText("風險偏高")).toBeInTheDocument();
  });
});
