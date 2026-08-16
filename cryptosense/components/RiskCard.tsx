import { usdCompact } from "@/lib/format";
import { translateTechnique } from "@/lib/i18n/incidentTerms";
import type { CitedSource } from "@/lib/ai/sources";
import type { IncidentSummary } from "@/lib/tools/incidents";

/** Partial shape: the object arrives key by key, so nothing is guaranteed. */
type PartialPoint = { text?: string; sourceId?: number | null };
type PartialCard = {
  stance?: string;
  confidence?: string;
  headline?: string;
  pros?: (PartialPoint | undefined)[];
  risks?: (PartialPoint | undefined)[];
};

export type RiskCardStatus = "streaming" | "done" | "error";

/**
 * Style per stance. The lookup always has a fallback: a drifted enum value
 * ("風險偏高" instead of "偏高風險") must still render as plain text rather
 * than leaving the header blank.
 */
const STANCE_STYLE: Record<string, string> = {
  偏高風險: "bg-down/10 text-down border-down/30",
  中性: "bg-strong text-body border-hairline",
  偏低風險: "bg-up/10 text-up border-up/30",
};
const STANCE_FALLBACK = "bg-strong text-body border-hairline";

function Points({
  title,
  points,
  sources,
}: {
  title: string;
  points: (PartialPoint | undefined)[];
  sources: CitedSource[];
}) {
  // Only render a point once its text has fully arrived; a half-written line
  // both makes the card jitter and reads as a claim the model never finished.
  const ready = points.filter((p): p is PartialPoint => Boolean(p?.text?.trim()));
  if (ready.length === 0) return null;

  return (
    <div>
      <h4 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-cb-muted">
        {title}
      </h4>
      <ul className="space-y-1.5">
        {ready.map((p, i) => {
          const cited = sources.find((s) => s.n === p.sourceId);
          return (
            <li key={i} className="flex gap-1.5 text-[13px] leading-relaxed text-body">
              {/* The citation leads the line rather than trailing it. Chinese
                  wraps between any two characters, so a trailing [n] regularly
                  ended up alone on the next line, reading as a broken glyph.
                  Leading it also removes the need for a separate bullet dot. */}
              {cited ? (
                <a
                  href={`#cs-${cited.n}`}
                  className="shrink-0 font-mono text-[11px] font-semibold leading-[1.6] text-brand-strong"
                >
                  [{cited.n}]
                </a>
              ) : (
                <span aria-hidden className="shrink-0 select-none text-cb-muted">
                  ·
                </span>
              )}
              <span className="min-w-0 flex-1">{p.text}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Chinese typography puts a space before a Latin run, but not before Chinese. */
const lead = (s: string) => (/^[A-Za-z0-9]/.test(s) ? ` ${s}` : s);

function Incidents({ data }: { data: IncidentSummary }) {
  const scope = data.scope === "chain" ? "這條鏈" : "這個協議";
  return (
    <div className="rounded-lg border border-hairline-soft bg-soft px-3 py-2.5">
      {/* No `uppercase` here: it suits the Chinese section labels but renders
          the chain's proper noun as "ETHEREUM". */}
      <h4 className="mb-1 text-[11px] font-semibold tracking-wide text-cb-muted">
        資安紀錄 · {data.label}
      </h4>
      <p className="text-[13px] leading-relaxed text-body">
        {scope}上有 <strong className="font-semibold text-ink">{data.count}</strong> 起有紀錄的資安事件
        {data.largest && (
          <>
            ，最大一起是 <strong className="font-semibold text-ink">{data.largest.name}</strong>（
            {data.largest.date}），損失{" "}
            <strong className="font-semibold text-ink">{usdCompact(data.largest.lossUsd)}</strong>
            {data.largest.technique ? `，手法為${lead(translateTechnique(data.largest.technique))}` : ""}
          </>
        )}
        。
      </p>
      {data.topTechniques.length > 0 && (
        <p className="mt-1 text-[11px] text-cb-muted">
          常見手法：
          {data.topTechniques
            .map((t) => `${translateTechnique(t.technique)}（${t.count}）`)
            .join("、")}
        </p>
      )}
    </div>
  );
}

/**
 * Structured risk card, rendered above the prose answer.
 *
 * Every number shown here comes from the server — market data via the chat
 * tools, incident figures via a pre-built index. The model contributes only
 * the stance, the confidence, and the prose of the bullet points, so there is
 * no slot in which it could place an invented figure.
 *
 * On `status === "error"` the component renders nothing: the card is an
 * enhancement, and a half-formed one would state a risk stance the model never
 * actually settled on.
 */
export function RiskCard({
  card,
  incidents,
  sources,
  status,
}: {
  card: PartialCard | null;
  incidents: IncidentSummary | null;
  sources: CitedSource[];
  status: RiskCardStatus;
}) {
  if (status === "error") return null;
  const hasHeader = Boolean(card?.stance || card?.confidence || card?.headline);
  if (!hasHeader && !incidents) return null;

  return (
    <section
      aria-label="風險彙整卡"
      className="mb-3 space-y-3 rounded-xl border border-hairline bg-card p-3.5 shadow-sm"
    >
      {(card?.stance || card?.confidence) && (
        <div className="flex flex-wrap items-center gap-2">
          {card?.stance && (
            <span
              className={`rounded-full border px-2.5 py-1 text-[12px] font-semibold ${
                STANCE_STYLE[card.stance] ?? STANCE_FALLBACK
              }`}
            >
              {card.stance}
            </span>
          )}
          {card?.confidence && (
            <span className="rounded-full bg-strong px-2.5 py-1 text-[11px] text-cb-muted">
              信心 {card.confidence}
            </span>
          )}
        </div>
      )}

      {card?.headline && (
        <p className="text-[14px] font-medium leading-relaxed text-ink">{card.headline}</p>
      )}

      {card?.pros && <Points title="正面觀點" points={card.pros} sources={sources} />}
      {card?.risks && <Points title="風險與盲點" points={card.risks} sources={sources} />}

      {incidents && <Incidents data={incidents} />}
    </section>
  );
}
