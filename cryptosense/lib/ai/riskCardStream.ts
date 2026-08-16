import type { IncidentSummary } from "@/lib/tools/incidents";

export type RiskCardEvent =
  | { type: "incidents"; data: IncidentSummary | null }
  | { type: "card"; data: Record<string, unknown> }
  | { type: "done" }
  | { type: "error" };

/**
 * Read the risk-card route's newline-delimited JSON stream.
 *
 * Chunk boundaries are chosen by the transport, not by the writer, so a single
 * JSON line routinely arrives split in two — everything up to the last newline
 * is parsed and the remainder is carried forward.
 *
 * A line that fails to parse is skipped rather than aborting: the card is an
 * enhancement, and one bad frame should not cost the frames after it.
 */
export async function readRiskCardStream(
  body: ReadableStream<Uint8Array> | null,
  on: (event: RiskCardEvent) => void,
): Promise<void> {
  if (!body) return;

  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const flush = (chunk: string) => {
    buffer += chunk;
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) emit(line);
  };

  const emit = (line: string) => {
    const t = line.trim();
    if (!t) return;
    try {
      on(JSON.parse(t) as RiskCardEvent);
    } catch {
      /* skip a malformed frame; later frames are still worth having */
    }
  };

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      flush(decoder.decode(value, { stream: true }));
    }
    emit(buffer); // a final object may arrive without a trailing newline
  } finally {
    reader.releaseLock();
  }
}
