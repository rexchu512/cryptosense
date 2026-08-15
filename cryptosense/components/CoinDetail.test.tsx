import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { CoinDetail } from "./CoinDetail";

// CoinDetail 接上 PriceChartPanel 後，該面板是會在 effect 呼叫 fetch 的 client
// component。CoinDetail 的測試只關心版面配置，面板自身行為由
// PriceChartPanel.test.tsx 涵蓋，這裡改用簡單樁元件避免在 jsdom 下真的打網路。
vi.mock("./PriceChartPanel", () => ({
  PriceChartPanel: (props: { symbol: string }) => (
    <div data-testid="price-chart-panel">{props.symbol} chart panel</div>
  ),
}));

const coin = {
  id: "ethereum", symbol: "ETH", name: "Ethereum", image: "https://x/eth.png", marketCapRank: 2,
  price: 3540.18, change24h: -0.82, change7d: -2.3, marketCap: 4.256e11, volume24h: 1.8e10,
  circulatingSupply: 1.202e8, spark7d: [3600, 3580, 3550, 3540], isStablecoin: false,
};
const news = [{ title: "ETF approved", url: "http://a", publishedAt: "2026-06-18T00:00:00Z" }];

describe("CoinDetail", () => {
  it("renders header, real logo, stat grid, trend chart, sources, news, AI prompt", () => {
    render(<CoinDetail coin={coin} news={news} updatedAt="2026-06-19 14:32" />);
    // 幣名同時出現在麵包屑與價格 hero，兩欄工作台佈局下允許多處命中
    expect(screen.getAllByText(/Ethereum/).length).toBeGreaterThan(0);
    expect(screen.getByRole("img", { name: "ETH" })).toHaveAttribute("src", "https://x/eth.png");
    // 4 格統計
    expect(screen.getByText("#2")).toBeInTheDocument();
    expect(screen.getByText(/425\.6[BK]?/)).toBeInTheDocument(); // 市值 usdCompact
    // 趨勢圖已換成 90 日價格面板（PriceChartPanel），該元件自身的行為由它自己的
    // 測試涵蓋；這裡只確認 CoinDetail 有把它接進版面。
    expect(screen.getByTestId("price-chart-panel")).toBeInTheDocument();
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
});
