import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CoinDetail } from "./CoinDetail";

const coin = {
  id: "ethereum", symbol: "ETH", name: "Ethereum", image: "https://x/eth.png", marketCapRank: 2,
  price: 3540.18, change24h: -0.82, change7d: -2.3, marketCap: 4.256e11, volume24h: 1.8e10,
  circulatingSupply: 1.202e8, spark7d: [3600, 3580, 3550, 3540],
};
const news = [{ title: "ETF approved", url: "http://a", publishedAt: "2026-06-18T00:00:00Z" }];

describe("CoinDetail", () => {
  it("renders header, real logo, stat grid, trend chart, sources, news, AI prompt", () => {
    render(<CoinDetail coin={coin} news={news} updatedAt="2026-06-19 14:32" />);
    expect(screen.getByText(/Ethereum/)).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "ETH" })).toHaveAttribute("src", "https://x/eth.png");
    // 4 格統計
    expect(screen.getByText("#2")).toBeInTheDocument();
    expect(screen.getByText(/425\.6[BK]?/)).toBeInTheDocument(); // 市值 usdCompact
    // 趨勢圖主動陳述標題
    expect(screen.getByText("ETH 7 日下跌 2.3%")).toBeInTheDocument();
    expect(screen.getByText(/我現在該進場/)).toBeInTheDocument();
    expect(screen.getByText(/資料來源：CoinGecko/)).toBeInTheDocument();
    expect(screen.getByText(/來源：CoinTelegraph/)).toBeInTheDocument();
    expect(screen.queryByText(/利多|利空|中性/)).toBeNull();
    expect(screen.getByTestId("coin-change").className).toMatch(/text-down-soft/);
    const link = screen.getByRole("link", { name: /ETF approved/ });
    expect(link).toHaveAttribute("href", "http://a");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
  });

  it("renders news with an unparseable date without crashing (no date shown)", () => {
    const badNews = [{ title: "Weird date item", url: "http://b", publishedAt: "not-a-date" }];
    render(<CoinDetail coin={coin} news={badNews} updatedAt="t" />);
    expect(screen.getByRole("link", { name: /Weird date item/ })).toBeInTheDocument();
    expect(screen.queryByText(/Invalid Date/)).toBeNull();
  });

  it("shows empty-news note when no news", () => {
    render(<CoinDetail coin={coin} news={[]} updatedAt="t" />);
    expect(screen.getByText(/近期無新聞/)).toBeInTheDocument();
  });

  it("shows a load-failure note (not 'no news') when news errored", () => {
    render(<CoinDetail coin={coin} news={[]} newsError="HTTP 500" updatedAt="t" />);
    expect(screen.getByText(/新聞暫時無法載入/)).toBeInTheDocument();
    expect(screen.queryByText(/近期無新聞/)).toBeNull();
  });

  it("omits the trend chart when there is not enough sparkline data", () => {
    const thinCoin = { ...coin, spark7d: [3540] };
    render(<CoinDetail coin={thinCoin} news={[]} updatedAt="t" />);
    expect(screen.queryByText(/7 日/)).toBeNull();
  });
});
