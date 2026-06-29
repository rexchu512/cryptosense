import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// Mock useChat — only test static UI (capability frame / disclaimer / chips)
vi.mock("@ai-sdk/react", () => ({
  useChat: () => ({
    messages: [],
    sendMessage: vi.fn(),
    status: "ready" as const,
    stop: vi.fn(),
    id: "test-chat",
    setMessages: vi.fn(),
    error: undefined,
    regenerate: vi.fn(),
    resumeStream: vi.fn(),
    addToolResult: vi.fn(),
    addToolOutput: vi.fn(),
    addToolApprovalResponse: vi.fn(),
    clearError: vi.fn(),
  }),
}));

import { Chat } from "./Chat";

describe("Chat", () => {
  it("frames capability + disclaimer, not 'ask me anything'", () => {
    render(<Chat coinId="ethereum" symbol="ETH" />);
    expect(screen.getByText(/風險面、近期新聞與個人知識/)).toBeInTheDocument();
    expect(screen.getByText(/非投資建議/)).toBeInTheDocument();
    expect(screen.queryByText(/問我任何事/)).toBeNull();
  });

  it("renders contextual chips containing the symbol", () => {
    render(<Chat coinId="ethereum" symbol="ETH" />);
    expect(
      screen.getByRole("button", { name: /ETH 主要下行風險/ }),
    ).toBeInTheDocument();
  });
});
