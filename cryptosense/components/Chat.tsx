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
import { Markdown } from "./Markdown";
import { CitationPanel } from "./CitationPanel";

/** Tool name to Chinese badge label */
const TOOL_LABEL: Record<string, string> = {
  getCoinData: "取得行情",
  getCryptoNews: "檢索新聞",
  searchKnowledgeBase: "查知識庫",
};

const DISCLAIMER = "本內容為 AI 整理之公開資訊，非投資建議，請自行查證評估風險。";

type MsgPart = UIMessagePart<UIDataTypes, UITools>;

/** Extract knowledge-base chunks from an assistant message's parts (searchKnowledgeBase tool output). */
function kbChunks(parts: MsgPart[]) {
  const p = parts.find(
    (x) =>
      isToolUIPart(x) &&
      getToolName(x) === "searchKnowledgeBase" &&
      x.state === "output-available",
  );
  const output = p && "output" in p ? (p as { output?: { data?: unknown } }).output : undefined;
  return (output?.data ?? []) as { text: string; source: string }[];
}

function defaultChips(symbol: string) {
  return [
    `${symbol} 近 24hr 波動？`,
    `${symbol} 跟 BTC 風險比較`,
    `知識庫怎麼看 ${symbol}`,
  ];
}

export function Chat({ coinId, symbol }: { coinId: string; symbol: string }) {
  const transport = useMemo(
    () => new DefaultChatTransport({ api: "/api/chat", body: { coinId, symbol } }),
    [coinId, symbol],
  );
  const { messages, sendMessage, status } = useChat({ transport });

  const [input, setInput] = useState("");
  const [chips, setChips] = useState<string[]>(() => defaultChips(symbol));
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevStatusRef = useRef(status);
  const busy = status !== "ready";

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

  // When an assistant turn finishes (status transitions into "ready" and the
  // last message is from the assistant), fetch fresh follow-up suggestions.
  // Keep the existing chips untouched on any failure or malformed response.
  useEffect(() => {
    const wasBusy = prevStatusRef.current !== "ready";
    prevStatusRef.current = status;
    if (!(wasBusy && status === "ready")) return;

    const last = messages[messages.length - 1];
    if (!last || last.role !== "assistant") return;

    const lastUserText = textOf(
      [...messages].reverse().find((m) => m.role === "user")?.parts ?? [],
    );
    const lastAnswerText = textOf(last.parts as MsgPart[]);

    let cancelled = false;
    fetch("/api/suggestions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ coinId, symbol, lastUserText, lastAnswerText }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return;
        const suggestions = data?.suggestions;
        if (Array.isArray(suggestions) && suggestions.length === 3) {
          setChips(suggestions);
        }
      })
      .catch(() => {
        /* keep existing chips; never surface fetch errors to the user */
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, messages, coinId, symbol]);

  return (
    <div className="rounded-lg border border-hairline bg-dark">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-dark-el px-3 py-2 text-xs text-on-dark-soft">
        <span>AI 研究助手 · 情境：{symbol}</span>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="max-h-96 space-y-3 overflow-y-auto p-3 text-sm"
        aria-live="polite"
      >
        {/* Capability frame */}
        <div className="rounded border border-dark-el bg-dark-el p-2 text-xs text-on-dark-soft">
          我可以協助分析{" "}
          <strong className="text-on-dark">
            {symbol} 的風險面、近期新聞與個人知識整合
          </strong>
          ，包括潛在下行風險與市場情緒。我不會報明牌或保證獲利。
        </div>

        {/* Rendered messages */}
        {messages.map((m) => {
          const parts = m.parts as MsgPart[];
          const text = textOf(parts);
          return (
            <div key={m.id} className={m.role === "user" ? "text-right" : undefined}>
              {m.role === "user" ? (
                <span className="inline-block rounded bg-cb-primary px-3 py-1.5 text-white">
                  {text}
                </span>
              ) : (
                <div className="rounded-md bg-dark-el p-3 text-on-dark">
                  {/* Telemetry Strip: completed retrieval steps, not an anthropomorphized "thinking..." narration */}
                  <TelemetryStrip parts={parts} />
                  <Markdown>{text}</Markdown>
                  <CitationPanel chunks={kbChunks(parts)} />
                  {/* Disclaimer tied to this specific answer — not just a footer line */}
                  <p className="mt-3 rounded border border-dark-el-2 bg-dark-el-2 px-2 py-1.5 text-xs font-medium text-on-dark-soft">
                    {DISCLAIMER}
                  </p>
                </div>
              )}
            </div>
          );
        })}

        {/* Streaming indicator */}
        {status === "submitted" && (
          <div className="text-xs text-on-dark-soft">彙整中…</div>
        )}

        {/* Error indicator */}
        {status === "error" && (
          <div className="text-xs text-down">回應失敗，請稍後重試。</div>
        )}

        {/* Contextual chips (dynamic: seeded with symbol, replaced per-turn by /api/suggestions) */}
        <div className="flex flex-wrap gap-2">
          {chips.map((c) => (
            <button
              key={c}
              disabled={busy}
              onClick={() => submit(c)}
              className="rounded-full border border-dark-el-2 px-3 py-1 text-xs text-on-dark hover:bg-dark-el disabled:opacity-50"
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Persistent disclaimer near the input, where the user's eyes land before/after asking */}
      <div className="border-t border-dark-el px-3 py-1.5 text-xs font-medium text-on-dark-soft">
        {DISCLAIMER}
      </div>

      {/* Input bar */}
      <div className="flex gap-2 border-t border-dark-el p-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.nativeEvent.isComposing) submit(input);
          }}
          placeholder={`繼續問關於 ${symbol} 的問題…`}
          className="flex-1 rounded bg-dark px-3 py-2 text-on-dark placeholder:text-on-dark-soft"
        />
        <button
          onClick={() => submit(input)}
          disabled={busy}
          className="rounded bg-cb-primary px-4 font-semibold text-white disabled:opacity-50"
        >
          送出
        </button>
      </div>
    </div>
  );
}

function textOf(parts: MsgPart[]) {
  return parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("");
}

/**
 * Telemetry Strip — a factual list of completed (or in-flight) retrieval
 * steps, rendered in monospace. This is deliberately NOT framed as
 * "AI is thinking..."; it reports verifiable tool calls, not a narrated
 * reasoning process (design.md forbids anthropomorphized reasoning copy).
 */
function TelemetryStrip({ parts }: { parts: MsgPart[] }) {
  const toolParts = parts.filter((p) => isToolUIPart(p));
  if (toolParts.length === 0) return null;

  return (
    <div className="mb-2 flex flex-wrap gap-1.5 font-mono text-[11px]">
      {toolParts.map((p, i) => {
        const name = getToolName(p);
        const done = p.state === "output-available" || p.state === "output-error";
        const isKb = name === "searchKnowledgeBase" && done;
        return (
          <span
            key={i}
            className={
              "rounded-full border px-2 py-0.5 " +
              (isKb
                ? "border-cb-primary/70 text-on-dark"
                : done
                  ? "border-dark-el-2 text-on-dark-soft"
                  : "border-down-soft text-down-soft")
            }
          >
            {done ? "✓" : "…"} {TOOL_LABEL[name] ?? name}
          </span>
        );
      })}
    </div>
  );
}
