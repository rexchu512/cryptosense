import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

// Mock useChat — module-level mock state lets each test control messages/status.
const mockUseChat = vi.fn();
vi.mock("@ai-sdk/react", () => ({
  useChat: (...args: unknown[]) => mockUseChat(...args),
}));

import { Chat, linkifyCitations } from "./Chat";

type ChatStatus = "ready" | "submitted" | "streaming" | "error";

function baseChatReturn(
  overrides: Partial<Omit<ReturnType<typeof defaultReturn>, "status">> & { status?: ChatStatus } = {},
) {
  return { ...defaultReturn(), ...overrides };
}

function defaultReturn() {
  return {
    messages: [] as unknown[],
    sendMessage: vi.fn(),
    status: "ready" as ChatStatus,
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
  };
}

describe("linkifyCitations", () => {
  it("turns bare [n] markers into anchor links to #cs-n (brackets preserved)", () => {
    expect(linkifyCitations("風險偏空[4]。")).toBe("風險偏空[\\[4\\]](#cs-4)。");
  });
  it("linkifies each marker in a stacked run independently", () => {
    expect(linkifyCitations("[1][2]")).toBe("[\\[1\\]](#cs-1)[\\[2\\]](#cs-2)");
  });
  it("leaves real markdown links untouched", () => {
    expect(linkifyCitations("[看這裡](https://x)")).toBe("[看這裡](https://x)");
  });
});

describe("Chat", () => {
  beforeEach(() => {
    mockUseChat.mockReset();
    mockUseChat.mockReturnValue(baseChatReturn());
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ suggestions: [] }),
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("frames capability + disclaimer, not 'ask me anything'", () => {
    render(<Chat coinId="ethereum" symbol="ETH" />);
    expect(screen.getByText(/風險面、近期新聞與你的知識庫/)).toBeInTheDocument();
    expect(screen.getByText(/非投資建議/)).toBeInTheDocument();
    expect(screen.queryByText(/問我任何事/)).toBeNull();
  });

  it("shows seed chips with the symbol before first answer", () => {
    render(<Chat coinId="ethereum" symbol="ETH" />);
    const chipButtons = screen.getAllByRole("button", { name: /ETH/ });
    expect(chipButtons.length).toBeGreaterThanOrEqual(3);
  });

  it("shows the disclaimer exactly once (near the composer, not repeated per message)", () => {
    mockUseChat.mockReturnValue(
      baseChatReturn({
        messages: [
          {
            id: "m1",
            role: "user",
            parts: [{ type: "text", text: "現在該進場嗎？" }],
          },
          {
            id: "m2",
            role: "assistant",
            parts: [{ type: "text", text: "風險偏中性，正反因素並陳。" }],
          },
        ],
      }),
    );
    render(<Chat coinId="ethereum" symbol="ETH" />);
    // Single persistent disclaimer near the composer — not duplicated per answer.
    const notices = screen.getAllByText(/非投資建議/);
    expect(notices.length).toBe(1);
  });

  it("renders assistant text via Markdown and a citation panel sourced from searchKnowledgeBase tool output", () => {
    mockUseChat.mockReturnValue(
      baseChatReturn({
        messages: [
          {
            id: "m1",
            role: "user",
            parts: [{ type: "text", text: "ETH 風險？" }],
          },
          {
            id: "m2",
            role: "assistant",
            parts: [
              {
                type: "tool-searchKnowledgeBase",
                toolCallId: "call1",
                state: "output-available",
                input: { query: "ETH risk" },
                output: {
                  data: [{ text: "節錄內容", source: "risk-notes.md" }],
                  sources: [
                    { n: 1, kind: "kb", title: "risk-notes.md", meta: "個人筆記 · 相似度 0.80" },
                  ],
                },
              },
              { type: "text", text: "**風險偏負面**，理由如下。" },
            ],
          },
        ],
      }),
    );
    render(<Chat coinId="ethereum" symbol="ETH" />);
    expect(screen.getByText("風險偏負面")).toBeInTheDocument();
    expect(screen.getByText(/risk-notes\.md/)).toBeInTheDocument();
  });

  it("shows a Telemetry Strip with Chinese tool labels distinguishing in-progress vs done", () => {
    mockUseChat.mockReturnValue(
      baseChatReturn({
        status: "streaming",
        messages: [
          {
            id: "m1",
            role: "user",
            parts: [{ type: "text", text: "ETH 現在行情？" }],
          },
          {
            id: "m2",
            role: "assistant",
            parts: [
              {
                type: "tool-getCoinData",
                toolCallId: "call1",
                state: "output-available",
                input: {},
                output: { price: 1 },
              },
              {
                type: "tool-getCryptoNews",
                toolCallId: "call2",
                state: "input-streaming",
                input: {},
              },
            ],
          },
        ],
      }),
    );
    render(<Chat coinId="ethereum" symbol="ETH" />);
    expect(screen.getByText(/取得行情/)).toBeInTheDocument();
    expect(screen.getByText(/檢索新聞/)).toBeInTheDocument();
  });

  it("replaces seed chips with dynamic suggestions fetched after an assistant answer completes", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ suggestions: ["ETH 近 24hr 波動？", "ETH vs BTC 風險", "知識庫怎麼看 ETH"] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const messages = [
      { id: "m1", role: "user", parts: [{ type: "text", text: "ETH 風險？" }] },
      { id: "m2", role: "assistant", parts: [{ type: "text", text: "風險偏中性。" }] },
    ];
    // Start "streaming" (busy), then transition to "ready" — mirrors the real
    // useChat lifecycle so the completion effect fires.
    mockUseChat.mockReturnValue(baseChatReturn({ messages, status: "streaming" }));
    const { rerender } = render(<Chat coinId="ethereum" symbol="ETH" />);

    mockUseChat.mockReturnValue(baseChatReturn({ messages, status: "ready" }));
    rerender(<Chat coinId="ethereum" symbol="ETH" />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/suggestions", expect.any(Object)));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "知識庫怎麼看 ETH" })).toBeInTheDocument(),
    );
  });

  it("keeps default chips if the suggestions fetch fails (no error shown to user)", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("network down"));
    vi.stubGlobal("fetch", fetchMock);

    const messages = [
      { id: "m1", role: "user", parts: [{ type: "text", text: "ETH 風險？" }] },
      { id: "m2", role: "assistant", parts: [{ type: "text", text: "風險偏中性。" }] },
    ];
    mockUseChat.mockReturnValue(baseChatReturn({ messages, status: "streaming" }));
    const { rerender } = render(<Chat coinId="ethereum" symbol="ETH" />);

    mockUseChat.mockReturnValue(baseChatReturn({ messages, status: "ready" }));
    rerender(<Chat coinId="ethereum" symbol="ETH" />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(screen.getAllByRole("button", { name: /ETH/ }).length).toBeGreaterThanOrEqual(3);
    expect(screen.queryByText(/失敗|錯誤/)).toBeNull();
  });
});
