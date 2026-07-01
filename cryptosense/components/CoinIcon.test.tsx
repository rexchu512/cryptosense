import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CoinIcon } from "./CoinIcon";

describe("CoinIcon", () => {
  it("renders an image when a logo url is given", () => {
    render(<CoinIcon image="https://x/eth.png" symbol="ETH" />);
    expect(screen.getByRole("img", { name: "ETH" })).toHaveAttribute("src", "https://x/eth.png");
  });
  it("falls back to a monogram when no image is given", () => {
    render(<CoinIcon symbol="ETH" />);
    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.getByText("E")).toBeInTheDocument();
  });
  it("falls back to a monogram when the image fails to load", () => {
    render(<CoinIcon image="https://x/broken.png" symbol="SOL" />);
    fireEvent.error(screen.getByRole("img", { name: "SOL" }));
    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.getByText("S")).toBeInTheDocument();
  });
});
