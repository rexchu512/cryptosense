import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const push = vi.fn();
// Mock every export the App Router might reach for, not just useRouter — an
// un-mocked next/navigation export throws "X is not a function" if anything
// in the tree touches it, even indirectly.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn(), back: vi.fn(), forward: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

import { TopBar } from "./TopBar";

beforeEach(() => push.mockClear());
afterEach(() => vi.unstubAllGlobals());

describe("TopBar", () => {
  it("shows the wordmark and nav, with no account/sign-in chrome", () => {
    render(<TopBar />);
    expect(screen.getByRole("link", { name: /CryptoSense/ })).toBeInTheDocument();
    expect(screen.queryByText(/登入|註冊|Sign/)).toBeNull();
  });

  it("shows search results after typing and navigates to the coin page on click", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [{ id: "ethereum", symbol: "ETH", name: "Ethereum", image: "" }] }),
    }));
    render(<TopBar />);
    fireEvent.change(screen.getByPlaceholderText("搜尋幣種或代號..."), { target: { value: "eth" } });
    const option = await screen.findByRole("option", { name: /Ethereum/ }, { timeout: 1000 });
    fireEvent.click(option);
    expect(push).toHaveBeenCalledWith("/coin/ethereum");
  });
});
