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

  it("navigates to the first result after ArrowDown then Enter", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        data: [
          { id: "ethereum", symbol: "ETH", name: "Ethereum", image: "" },
          { id: "bitcoin", symbol: "BTC", name: "Bitcoin", image: "" },
        ],
      }),
    }));
    render(<TopBar />);
    const input = screen.getByPlaceholderText("搜尋幣種或代號...");
    fireEvent.change(input, { target: { value: "e" } });
    await screen.findByRole("option", { name: /Ethereum/ }, { timeout: 1000 });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(push).toHaveBeenCalledWith("/coin/ethereum");
  });

  it("stops at the last item on repeated ArrowDown (no wrap) then navigates on Enter", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        data: [
          { id: "ethereum", symbol: "ETH", name: "Ethereum", image: "" },
          { id: "bitcoin", symbol: "BTC", name: "Bitcoin", image: "" },
        ],
      }),
    }));
    render(<TopBar />);
    const input = screen.getByPlaceholderText("搜尋幣種或代號...");
    fireEvent.change(input, { target: { value: "e" } });
    await screen.findByRole("option", { name: /Ethereum/ }, { timeout: 1000 });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(push).toHaveBeenCalledWith("/coin/bitcoin");
  });

  it("closes the dropdown on Escape without clearing the input text", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [{ id: "ethereum", symbol: "ETH", name: "Ethereum", image: "" }] }),
    }));
    render(<TopBar />);
    const input = screen.getByPlaceholderText("搜尋幣種或代號...") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "eth" } });
    await screen.findByRole("option", { name: /Ethereum/ }, { timeout: 1000 });
    fireEvent.keyDown(input, { key: "Escape" });
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(input.value).toBe("eth");
  });

  it("removes the placeholder 幣種/知識庫 nav links but keeps 市場", () => {
    render(<TopBar />);
    expect(screen.queryByRole("link", { name: "幣種" })).toBeNull();
    expect(screen.queryByRole("link", { name: "知識庫" })).toBeNull();
    expect(screen.getByRole("link", { name: "市場" })).toBeInTheDocument();
  });
});
