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
import { SourceTray } from "./SourceTray";
import type { CitedSource } from "@/lib/ai/sources";

/** Tool name to Chinese badge label */
const TOOL_LABEL: Record<string, string> = {
  getCoinData: "取得行情",
  getCryptoNews: "檢索新聞",
  searchKnowledgeBase: "查知識庫",
};

const DISCLAIMER = "本內容為 AI 整理之公開資訊，非投資建議，請自行查證評估風險。";

type MsgPart = UIMessagePart<UIDataTypes, UITools>;

/** Collect the unified, numbered citation sources across ALL three tools'
 *  outputs (market / news / knowledge-base). Each tool's output carries a
 *  `sources: CitedSource[]` assigned by the per-turn registry; the model cites
 *  them inline as `[n]`. Dedupe by n, sort ascending. */
function allSources(parts: MsgPart[]): CitedSource[] {
  const acc: CitedSource[] = [];
  for (const p of parts) {
    if (isToolUIPart(p) && p.state === "output-available") {
      const out = (p as { output?: { sources?: CitedSource[] } }).output;
      if (out?.sources) acc.push(...out.sources);
    }
  }
  const seen = new Set<number>();
  return acc
    .filter((s) => (seen.has(s.n) ? false : (seen.add(s.n), true)))
    .sort((a, b) => a.n - b.n);
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
    <div className="flex flex-col overflow-hidden rounded-2xl border border-hairline bg-card shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-hairline-soft bg-gradient-to-b from-cb-primary-soft/50 to-transparent px-4 py-3">
        <span className="h-2 w-2 rounded-full bg-brand ring-4 ring-glow/20" />
        <span className="text-sm font-bold text-ink">AI 研究助手</span>
        <span className="ml-auto rounded-full bg-cb-primary-soft px-2.5 py-0.5 text-[11px] font-medium text-brand-strong">
          情境：{symbol}
        </span>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="max-h-[28rem] scroll-smooth space-y-4 overflow-y-auto p-4"
        aria-live="polite"
      >
        {/* Capability frame — states scope, not "ask me anything" */}
        <div className="rounded-xl border border-hairline-soft bg-soft p-3 text-[13px] leading-relaxed text-body">
          我可以就{" "}
          <strong className="font-semibold text-ink">
            {symbol} 的風險面、近期新聞與你的知識庫
          </strong>
          作答，包含潛在下行風險與市場情緒。不報明牌、不保證獲利，並附上出處。
        </div>

        {/* Rendered messages */}
        {messages.map((m) => {
          const parts = m.parts as MsgPart[];
          const text = textOf(parts);
          return (
            <div key={m.id} className={m.role === "user" ? "flex justify-end" : undefined}>
              {m.role === "user" ? (
                <span className="inline-block max-w-[88%] rounded-2xl rounded-br-sm bg-cb-primary px-3 py-2 text-sm text-white">
                  {text}
                </span>
              ) : (
                <div className="border-t border-hairline-soft pt-3 first:border-t-0 first:pt-0">
                  {/* Telemetry Strip: completed retrieval steps, not an anthropomorphized "thinking..." narration */}
                  <TelemetryStrip parts={parts} />
                  <Markdown>{linkifyCitations(text)}</Markdown>
                  <SourceTray sources={allSources(parts)} />
                </div>
              )}
            </div>
          );
        })}

        {/* Streaming indicator */}
        {status === "submitted" && (
          <div className="text-xs text-cb-muted">彙整中…</div>
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
              className="rounded-full border border-hairline px-3 py-1 text-xs text-cb-primary transition-colors hover:border-glow hover:bg-soft disabled:opacity-50"
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Single disclaimer, near the composer where the user's eyes land */}
      <div className="border-t border-hairline-soft px-4 py-2 text-[11px] text-cb-muted">
        {DISCLAIMER}
      </div>

      {/* Input bar */}
      <div className="flex items-end gap-2 border-t border-hairline p-2.5">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.nativeEvent.isComposing) submit(input);
          }}
          placeholder={`繼續問關於 ${symbol} 的問題…`}
          className="flex-1 rounded-xl border border-hairline bg-canvas px-3 py-2 text-sm text-ink placeholder:text-cb-muted focus:border-glow focus:outline-none focus:ring-2 focus:ring-glow/20"
        />
        <button
          onClick={() => submit(input)}
          disabled={busy}
          className="rounded-xl bg-cb-primary px-4 py-2 text-sm font-semibold text-white transition-opacity disabled:opacity-50"
        >
          送出
        </button>
      </div>
    </div>
  );
}

/** Turn bare `[n]` citation markers into anchor links to the matching source
 *  row (`#cs-n`), so users can jump straight to the source instead of hunting
 *  for it. `\[n\]` keeps the brackets visible in the rendered link text. */
export function linkifyCitations(text: string): string {
  return text.replace(/\[(\d+)\]/g, "[\\[$1\\]](#cs-$1)");
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
                ? "border-brand-strong/50 bg-cb-primary-soft text-brand-strong"
                : done
                  ? "border-hairline text-cb-muted"
                  : "border-brand-strong/40 text-brand-strong")
            }
          >
            {done ? "✓" : "…"} {TOOL_LABEL[name] ?? name}
          </span>
        );
      })}
    </div>
  );
}
