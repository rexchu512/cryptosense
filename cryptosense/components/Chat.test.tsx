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

describe("Chat risk card", () => {
  const toolPart = {
    type: "tool-getCoinData",
    toolCallId: "call1",
    state: "output-available",
    input: {},
    output: {
      sources: [{ n: 1, kind: "market", title: "Ethereum 市場資料快照", meta: "CoinGecko" }],
    },
  };

  const answered = [
    { id: "m1", role: "user", parts: [{ type: "text", text: "ETH 風險？" }] },
    { id: "m2", role: "assistant", parts: [toolPart, { type: "text", text: "風險偏中性。" }] },
  ];

  function ndjson(...objs: unknown[]) {
    const enc = new TextEncoder();
    return new ReadableStream({
      start(c) {
        for (const o of objs) c.enqueue(enc.encode(JSON.stringify(o) + "\n"));
        c.close();
      },
    });
  }

  /** Suggestions and the risk card share the global fetch; branch on the URL. */
  function routedFetch(cardBody: () => ReadableStream | null) {
    return vi.fn().mockImplementation((url: string) =>
      url === "/api/risk-card"
        ? Promise.resolve({ ok: true, body: cardBody() })
        : Promise.resolve({ ok: true, json: async () => ({ suggestions: [] }) }),
    );
  }

  function completeTurn(messages: unknown[]) {
    mockUseChat.mockReturnValue(baseChatReturn({ messages, status: "streaming" }));
    const { rerender } = render(<Chat coinId="ethereum" symbol="ETH" />);
    mockUseChat.mockReturnValue(baseChatReturn({ messages, status: "ready" }));
    rerender(<Chat coinId="ethereum" symbol="ETH" />);
  }

  beforeEach(() => {
    mockUseChat.mockReset();
    mockUseChat.mockReturnValue(baseChatReturn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("requests a card with the question, the answer and the cited sources", async () => {
    const fetchMock = routedFetch(() => ndjson({ type: "done" }));
    vi.stubGlobal("fetch", fetchMock);
    completeTurn(answered);

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith("/api/risk-card", expect.any(Object)),
    );
    const call = fetchMock.mock.calls.find((c: unknown[]) => c[0] === "/api/risk-card")!;
    const body = JSON.parse((call[1] as { body: string }).body);
    expect(body).toMatchObject({ symbol: "ETH", coinId: "ethereum", question: "ETH 風險？" });
    expect(body.answer).toContain("風險偏中性");
    expect(body.sources[0].n).toBe(1);
  });

  it("renders the card above the answer once the stream commits it", async () => {
    vi.stubGlobal(
      "fetch",
      routedFetch(() =>
        ndjson(
          { type: "incidents", data: null },
          {
            type: "card",
            data: {
              stance: "偏高風險",
              confidence: "中",
              headline: "波動放大，進場前先確認部位規模。",
              pros: [{ text: "流動性充足", sourceId: 1 }, { text: "開發活躍", sourceId: null }],
              risks: [{ text: "波動放大", sourceId: 1 }, { text: "生態有事件", sourceId: null }],
            },
          },
          { type: "done" },
        ),
      ),
    );
    completeTurn(answered);

    await waitFor(() => expect(screen.getByText("偏高風險")).toBeInTheDocument());
    expect(screen.getByText("波動放大，進場前先確認部位規模。")).toBeInTheDocument();
    // The prose answer and its source tray are untouched.
    expect(screen.getByText(/風險偏中性/)).toBeInTheDocument();
  });

  it("shows no card when generation errors, and keeps the prose answer", async () => {
    vi.stubGlobal(
      "fetch",
      routedFetch(() =>
        ndjson({ type: "card", data: { stance: "偏高風險" } }, { type: "error" }),
      ),
    );
    completeTurn(answered);

    await waitFor(() => expect(screen.getByText(/風險偏中性/)).toBeInTheDocument());
    expect(screen.queryByLabelText("風險彙整卡")).toBeNull();
  });

  it("survives a failed card request without surfacing an error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) =>
        url === "/api/risk-card"
          ? Promise.reject(new Error("network down"))
          : Promise.resolve({ ok: true, json: async () => ({ suggestions: [] }) }),
      ),
    );
    completeTurn(answered);

    await waitFor(() => expect(screen.getByText(/風險偏中性/)).toBeInTheDocument());
    expect(screen.queryByLabelText("風險彙整卡")).toBeNull();
    expect(screen.queryByText(/失敗|錯誤/)).toBeNull();
  });

  it("does not request a card for an answer that called no tools", async () => {
    // Scope refusals and small talk retrieve nothing, so there is no evidence
    // to take a risk stance on.
    const fetchMock = routedFetch(() => ndjson({ type: "done" }));
    vi.stubGlobal("fetch", fetchMock);
    completeTurn([
      { id: "m1", role: "user", parts: [{ type: "text", text: "你是誰？" }] },
      { id: "m2", role: "assistant", parts: [{ type: "text", text: "我只做風險研究。" }] },
    ]);

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(fetchMock.mock.calls.some((c: unknown[]) => c[0] === "/api/risk-card")).toBe(false);
  });
});
