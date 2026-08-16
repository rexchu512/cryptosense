import { streamRiskCard, type RiskCardInput } from "@/lib/ai/riskCard";
import { getIncidentSummary } from "@/lib/tools/incidents";
import type { CitedSource } from "@/lib/ai/sources";

export const maxDuration = 30;

/**
 * Second pass over an answer the chat route has already produced: emits the
 * structured risk card.
 *
 * The response is newline-delimited JSON rather than the AI SDK's UI-message
 * stream, because two different things travel down it — a settled block of
 * incident facts the server looked up, and the model's card as it forms:
 *
 *   {"type":"incidents","data":<summary|null>}
 *   {"type":"card","data":<partial card>}     (repeated)
 *   {"type":"done"}   or   {"type":"error"}
 *
 * The incident block goes first so the card can show the one section that is
 * guaranteed accurate while the model is still writing the rest.
 */
function line(obj: unknown) {
  return new TextEncoder().encode(JSON.stringify(obj) + "\n");
}

function bad(reason: string) {
  return Response.json({ error: reason }, { status: 400 });
}

export async function POST(req: Request) {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return bad("malformed json");
  }

  const { symbol, coinId, question, answer, sources } = (raw ?? {}) as Record<string, unknown>;

  // Same validation strength as /api/chat: these values reach a prompt.
  if (typeof symbol !== "string" || symbol.length === 0 || symbol.length > 16) {
    return bad("invalid symbol");
  }
  if (typeof coinId !== "string" || coinId.length === 0 || coinId.length > 64) {
    return bad("invalid coinId");
  }
  if (typeof question !== "string" || question.length === 0 || question.length > 2000) {
    return bad("invalid question");
  }
  if (typeof answer !== "string" || answer.length === 0 || answer.length > 20000) {
    return bad("invalid answer");
  }
  if (!Array.isArray(sources)) {
    return bad("sources must be an array");
  }

  const input: RiskCardInput = {
    symbol,
    coinId,
    question,
    answer,
    sources: sources as CitedSource[],
  };

  // Settled facts, looked up synchronously — no model involved, so this block
  // is correct even if the generation below falls over.
  const incidents = getIncidentSummary({ symbol, coinId });

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(line({ type: "incidents", data: incidents }));
      try {
        const result = streamRiskCard({ input });
        for await (const partial of result.partialOutputStream) {
          controller.enqueue(line({ type: "card", data: partial }));
        }
        controller.enqueue(line({ type: "done" }));
      } catch {
        // No "done" marker: the client keeps whatever it had and, because it
        // only commits a card on "done", ends up showing none. A half card is
        // worse than no card — it would state a risk stance the model never
        // actually settled on.
        controller.enqueue(line({ type: "error" }));
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
