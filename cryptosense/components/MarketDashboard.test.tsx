import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MarketDashboard } from "./MarketDashboard";

const overview = { totalMarketCap: 3.42e12, totalVolume: 9.8e10, btcDominance: 54.3, coins: [
  { id: "bitcoin", symbol: "BTC", name: "Bitcoin", price: 67200, change24h: 1.2, marketCap: 1.3e12, spark7d: [1,2,3] },
  { id: "dogecoin", symbol: "DOGE", name: "Dogecoin", price: 0.12, change24h: -5.2, marketCap: 1e10, spark7d: [3,2,1] },
] };
const fg = { value: 52, label: "Neutral" };

describe("MarketDashboard", () => {
  it("shows KPI tiles (fear/greed, BTC dominance) + green/red by direction", () => {
    render(<MarketDashboard overview={overview} fearGreed={fg} />);
    expect(screen.getByText("52")).toBeInTheDocument();
    expect(screen.getByText("54.3%")).toBeInTheDocument(); // BTC 主導
    expect(screen.getByTestId("change-bitcoin").className).toMatch(/text-green/);
    expect(screen.getByTestId("change-dogecoin").className).toMatch(/text-red/);
  });
  it("links coin rows to detail page", () => {
    render(<MarketDashboard overview={overview} fearGreed={fg} />);
    expect(screen.getByRole("link", { name: /Bitcoin/ })).toHaveAttribute("href", "/coin/bitcoin");
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
});
