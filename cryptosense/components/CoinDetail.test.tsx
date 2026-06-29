import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CoinDetail } from "./CoinDetail";

const coin = { id: "ethereum", symbol: "ETH", name: "Ethereum", price: 3540.18, change24h: -0.82, marketCap: 1, volume24h: 1, circulatingSupply: 1 };
const news = [{ title: "ETF approved", url: "http://a", publishedAt: "2026-06-18T00:00:00Z", sentiment: "positive" as const }];

describe("CoinDetail", () => {
  it("renders header, news, and AI CTA", () => {
    render(<CoinDetail coin={coin} news={news} updatedAt="2026-06-19 14:32" />);
    expect(screen.getByText(/Ethereum/)).toBeInTheDocument();
    expect(screen.getByText(/ETF approved/)).toBeInTheDocument();
    expect(screen.getByText(/我現在該進場/)).toBeInTheDocument();
  });
  it("shows empty-news note when no news", () => {
    render(<CoinDetail coin={coin} news={[]} updatedAt="t" />);
    expect(screen.getByText(/近期無新聞/)).toBeInTheDocument();
  });
});
