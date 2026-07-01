import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PriceTrendChart } from "./PriceTrendChart";

describe("PriceTrendChart", () => {
  it("states a downward finding with symbol and magnitude", () => {
    render(<PriceTrendChart symbol="ETH" data={[100, 98, 95, 97]} change7d={-2.3} />);
    expect(screen.getByText("ETH 7 日下跌 2.3%")).toBeInTheDocument();
    expect(screen.getByText(/CoinGecko/)).toBeInTheDocument();
  });
  it("states an upward finding when change7d is positive", () => {
    render(<PriceTrendChart symbol="SOL" data={[10, 11, 12]} change7d={9.8} />);
    expect(screen.getByText("SOL 7 日上漲 9.8%")).toBeInTheDocument();
  });
  it("renders nothing when there is not enough data to draw a trend", () => {
    const { container } = render(<PriceTrendChart symbol="ETH" data={[100]} change7d={0} />);
    expect(container).toBeEmptyDOMElement();
  });
});
