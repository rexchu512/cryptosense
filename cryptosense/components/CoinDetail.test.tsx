import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CoinDetail } from "./CoinDetail";

const coin = { id: "ethereum", symbol: "ETH", name: "Ethereum", price: 3540.18, change24h: -0.82, marketCap: 1, volume24h: 1, circulatingSupply: 1 };
// NewsItem 新型別：無 sentiment 欄位
const news = [{ title: "ETF approved", url: "http://a", publishedAt: "2026-06-18T00:00:00Z" }];

describe("CoinDetail", () => {
  it("renders header, sources, news (time + safe external link), AI CTA", () => {
    render(<CoinDetail coin={coin} news={news} updatedAt="2026-06-19 14:32" />);
    expect(screen.getByText(/Ethereum/)).toBeInTheDocument();
    expect(screen.getByText(/我現在該進場/)).toBeInTheDocument();
    // 行情來源不變
    expect(screen.getByText(/資料來源：CoinGecko/)).toBeInTheDocument();
    // 新聞來源改為 CoinTelegraph
    expect(screen.getByText(/來源：CoinTelegraph/)).toBeInTheDocument();
    // 無 sentiment 標籤（利多/利空/中性）
    expect(screen.queryByText(/利多|利空|中性/)).toBeNull();
    // 24h 漲跌 -0.82 → 紅
    expect(screen.getByTestId("coin-change").className).toMatch(/text-red/);
    // 新聞連結安全開新分頁
    const link = screen.getByRole("link", { name: /ETF approved/ });
    expect(link).toHaveAttribute("href", "http://a");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
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
