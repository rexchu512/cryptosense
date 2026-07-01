import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { MarketDashboard } from "./MarketDashboard";

const overview = {
  totalMarketCap: 3.42e12, totalVolume: 9.8e10, btcDominance: 54.3,
  coins: [
    { id: "bitcoin", symbol: "BTC", name: "Bitcoin", image: "https://x/btc.png", marketCapRank: 1, price: 67200, change1h: 0.1, change24h: 1.2, change7d: 3.0, marketCap: 1.3e12, spark7d: [1, 2, 3], rankChange: "same" as const },
    { id: "dogecoin", symbol: "DOGE", name: "Dogecoin", image: "https://x/doge.png", marketCapRank: 9, price: 0.12, change1h: -0.4, change24h: -5.2, change7d: -1.0, marketCap: 1e10, spark7d: [3, 2, 1], rankChange: "down" as const },
  ],
};
const fg = { value: 52, label: "Neutral" };

describe("MarketDashboard", () => {
  it("shows KPI tiles (fear/greed, BTC dominance) + up/down-soft by direction", () => {
    render(<MarketDashboard overview={overview} fearGreed={fg} />);
    expect(screen.getByText("52")).toBeInTheDocument();
    expect(screen.getByText("54.3%")).toBeInTheDocument();
    expect(screen.getByTestId("change-bitcoin").className).toMatch(/text-up/);
    expect(screen.getByTestId("change-dogecoin").className).toMatch(/text-down/);
  });

  it("shows 1H and 7D columns alongside 24H", () => {
    render(<MarketDashboard overview={overview} fearGreed={fg} />);
    expect(screen.getByTestId("change1h-bitcoin")).toHaveTextContent("0.10%");
    expect(screen.getByTestId("change7d-bitcoin")).toHaveTextContent("3.00%");
  });

  it("links coin rows to detail page and renders a coin logo", () => {
    render(<MarketDashboard overview={overview} fearGreed={fg} />);
    const link = screen.getByRole("link", { name: /Bitcoin/ });
    expect(link).toHaveAttribute("href", "/coin/bitcoin");
    // Bitcoin also appears in the movers band (it's a gainer), so scope the
    // image lookup to this row's own link instead of querying the whole page.
    expect(within(link).getByRole("img")).toHaveAttribute("src", "https://x/btc.png");
  });

  it("does not list the same coin in both gainers and losers", () => {
    render(<MarketDashboard overview={overview} fearGreed={fg} />);
    const gainers = screen.getByTestId("gainers").textContent ?? "";
    const losers = screen.getByTestId("losers").textContent ?? "";
    expect(gainers).toContain("BTC");
    expect(gainers).not.toContain("DOGE");
    expect(losers).toContain("DOGE");
    expect(losers).not.toContain("BTC");
  });

  it("filters the ranking table by name or symbol as the user types", () => {
    render(<MarketDashboard overview={overview} fearGreed={fg} />);
    expect(screen.getByText("Dogecoin")).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText("搜尋幣種..."), { target: { value: "btc" } });
    expect(screen.queryByText("Dogecoin")).toBeNull();
    expect(screen.getByText("Bitcoin")).toBeInTheDocument();
  });
});
