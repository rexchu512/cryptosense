"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { useChat } from "@ai-sdk/react";
import {
  DefaultChatTransport,
  isToolUIPart,
  getToolName,
  type UIMessagePart,
  type UIDataTypes,
  type UITools,
} from "ai";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

/** Tool name to Chinese badge label */
const TOOL_LABEL: Record<string, string> = {
  getCoinData: "取得行情",
  getCryptoNews: "檢索新聞",
  searchKnowledgeBase: "查知識庫",
};

export function Chat({ coinId, symbol }: { coinId: string; symbol: string }) {
  const transport = useMemo(
    () => new DefaultChatTransport({ api: "/api/chat", body: { coinId } }),
    [coinId],
  );
  const { messages, sendMessage, status } = useChat({ transport });

  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const busy = status !== "ready";

  const chips = [
    `${symbol} 主要下行風險？`,
    `${symbol} 跟 BTC 比較`,
    `${symbol} 最新利空新聞`,
  ];

  const submit = (text: string) => {
    if (!text.trim() || busy) return;
    sendMessage({ text });
    setInput("");
  };

  // Auto-scroll on new content
  useEffect(() => {
    const el = scrollRef.current;
    if (el && typeof el.scrollTo === "function") {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    }
  }, [messages, status]);

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 px-3 py-2 text-xs text-slate-400">
        <span>AI 研究助手 · 情境：{symbol}</span>
        <span>AI 生成，非投資建議</span>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="max-h-96 space-y-3 overflow-y-auto p-3 text-sm"
        aria-live="polite"
      >
        {/* Capability frame */}
        <div className="rounded border border-slate-700 bg-slate-800 p-2 text-xs text-slate-300">
          我可以協助分析{" "}
          <strong>{symbol} 的風險面、近期新聞與個人知識整合</strong>
          ，包括潛在下行風險與市場情緒。我不會報明牌或保證獲利。
        </div>

        {/* Rendered messages */}
        {messages.map((m) => (
          <div
            key={m.id}
            className={m.role === "user" ? "text-right" : undefined}
          >
            {m.role === "user" ? (
              <span className="inline-block rounded bg-blue-600 px-3 py-1.5 text-white">
                {m.parts
                  .filter(
                    (p): p is { type: "text"; text: string } =>
                      p.type === "text",
                  )
                  .map((p) => p.text)
                  .join("")}
              </span>
            ) : (
              <div className="prose prose-invert max-w-none text-slate-200">
                {/* Tool step badges */}
                <ToolBadges parts={m.parts} />
                {/* Text parts rendered as markdown */}
                {m.parts
                  .filter(
                    (p): p is { type: "text"; text: string } =>
                      p.type === "text",
                  )
                  .map((p, i) => (
                    <Markdown
                      key={i}
                      remarkPlugins={[remarkGfm]}
                      components={{
                        a: ({ href, children }) => (
                          <a
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {children}
                          </a>
                        ),
                      }}
                    >
                      {p.text}
                    </Markdown>
                  ))}
              </div>
            )}
          </div>
        ))}

        {/* Streaming indicator */}
        {status === "submitted" && (
          <div className="text-xs text-slate-400">彙整中…</div>
        )}

        {/* Error indicator */}
        {status === "error" && (
          <div className="text-xs text-red-400">回應失敗，請稍後重試。</div>
        )}

        {/* Contextual chips */}
        <div className="flex flex-wrap gap-2">
          {chips.map((c) => (
            <button
              key={c}
              disabled={busy}
              onClick={() => submit(c)}
              className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-200 hover:bg-slate-800 disabled:opacity-50"
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Input bar */}
      <div className="flex gap-2 border-t border-slate-800 p-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.nativeEvent.isComposing) submit(input);
          }}
          placeholder={`繼續問關於 ${symbol} 的問題…`}
          className="flex-1 rounded bg-slate-950 px-3 py-2 text-slate-200 placeholder:text-slate-500"
        />
        <button
          onClick={() => submit(input)}
          disabled={busy}
          className="rounded bg-blue-600 px-4 font-semibold text-white disabled:opacity-50"
        >
          送出
        </button>
      </div>
    </div>
  );
}

/** Renders tool-step badges for an assistant message */
function ToolBadges({
  parts,
}: {
  parts: UIMessagePart<UIDataTypes, UITools>[];
}) {
  const toolParts = parts.filter((p) => isToolUIPart(p));
  if (toolParts.length === 0) return null;

  return (
    <div className="mb-1 flex flex-wrap gap-1 text-[10px]">
      {toolParts.map((p, i) => {
        const name = getToolName(p);
        const done = p.state === "output-available" || p.state === "output-error";
        return (
          <span
            key={i}
            className={`rounded-full px-2 py-0.5 ${
              done
                ? "bg-slate-700 text-slate-300"
                : "bg-amber-900/40 text-amber-300"
            }`}
          >
            {done ? "✓" : "⏳"} {TOOL_LABEL[name] ?? name}
          </span>
        );
      })}
    </div>
  );
}
