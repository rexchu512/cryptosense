import type { CitedSource } from "@/lib/ai/sources";

const BADGE: Record<CitedSource["kind"], { label: string; cls: string }> = {
  market: { label: "行情", cls: "text-cb-muted" },
  news: { label: "新聞", cls: "text-brand-strong" },
  kb: { label: "知識庫", cls: "text-indigo" },
};

function ExtIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="shrink-0 text-cb-muted"
      aria-hidden
    >
      <path d="M7 17 17 7M8 7h9v9" />
    </svg>
  );
}

function RowBody({ s }: { s: CitedSource }) {
  const badge = BADGE[s.kind];
  return (
    <>
      <span className="shrink-0 font-mono text-[11px] font-semibold text-brand-strong">
        [{s.n}]
      </span>
      <span
        className={`shrink-0 rounded-full bg-strong px-2 py-0.5 font-mono text-[9px] ${badge.cls}`}
      >
        {badge.label}
      </span>
      <span className="min-w-0 flex-1">
        <span className="font-medium text-ink">{s.title}</span>
        <span className="mt-0.5 block text-[11px] text-cb-muted">{s.meta}</span>
      </span>
    </>
  );
}

/**
 * Unified citation tray for all three tools. Each source carries a stable
 * 1-based `n` (from the per-turn registry) cited inline as `[n]`; the row has
 * `id="cs-{n}"` so those inline links can jump to it. News/market sources link
 * out; knowledge-base sources expand their retrieved chunk in place. Height is
 * capped so a long source list never buries the answer.
 */
export function SourceTray({ sources }: { sources: CitedSource[] }) {
  if (!sources || sources.length === 0) return null;
  const rowCls =
    "flex items-center gap-2 px-3 py-2.5 text-[12.5px] scroll-mt-14";
  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-hairline-soft">
      <div className="bg-strong px-3 py-2 text-[10px] uppercase tracking-wide text-cb-muted">
        來源 · {sources.length} 筆 · 每筆可回溯
      </div>
      <div className="max-h-64 overflow-y-auto">
        {sources.map((s) => {
          if (s.url) {
            return (
              <a
                key={s.n}
                id={`cs-${s.n}`}
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`${rowCls} border-t border-hairline-soft hover:bg-soft`}
              >
                <RowBody s={s} />
                <ExtIcon />
              </a>
            );
          }
          if (s.snippet) {
            return (
              <details
                key={s.n}
                id={`cs-${s.n}`}
                className="scroll-mt-14 border-t border-hairline-soft [&_summary::-webkit-details-marker]:hidden [&_summary]:list-none"
              >
                <summary className={`${rowCls} cursor-pointer hover:bg-soft`}>
                  <RowBody s={s} />
                  <span className="shrink-0 text-[11px] text-brand-strong">展開片段</span>
                </summary>
                <div className="whitespace-pre-wrap border-t border-hairline-soft bg-soft px-3 py-2.5 text-[12px] leading-relaxed text-body">
                  {s.snippet}
                </div>
              </details>
            );
          }
          return (
            <div key={s.n} id={`cs-${s.n}`} className={`${rowCls} border-t border-hairline-soft`}>
              <RowBody s={s} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
