import "server-only";
import OpenAI from "openai";
import { ok, fail } from "@/lib/tools/http";
import type { ToolResult } from "@/lib/tools/types";

export type KbChunk = { text: string; source: string; score?: number };

let _client: OpenAI | null = null;
function getClient(): Pick<OpenAI, "vectorStores"> {
  if (!_client) _client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _client;
}

const SCORE_THRESHOLD = 0.35;
/** The API allows 1–50 and defaults to 10. We asked for 3, which against a
 *  corpus with this much bot chatter almost guarantees the top hits are junk.
 *  Held at the default rather than pushed to 50 until the corpus is cleaned —
 *  more results also means more noise reaching the model. */
const MAX_RESULTS = 10;

/** Retrieval was previously invisible: no way to tell which files came back or
 *  how they scored, so no way to judge whether a change helped. Silent under
 *  vitest to keep test output readable. */
function logRetrieval(query: string, returned: number, kept: KbChunk[]) {
  if (process.env.NODE_ENV === "test") return;
  const top = kept
    .slice(0, 5)
    .map((c) => `${c.source}@${(c.score ?? 0).toFixed(3)}`)
    .join(", ");
  console.info(
    `[kb] query=${JSON.stringify(query)} returned=${returned} kept=${kept.length} top=[${top}]`,
  );
}

export async function searchKnowledgeBase(
  query: string,
  client: Pick<OpenAI, "vectorStores"> = getClient(),
): Promise<ToolResult<KbChunk[]>> {
  const vsId = process.env.OPENAI_VECTOR_STORE_ID;
  if (!vsId) return fail("KnowledgeBase", "vector store not configured");
  try {
    // OpenAI SDK: vectorStores.search(vectorStoreID, body, options?) — the
    // store ID is a POSITIONAL first arg, not a body field.
    const res: any = await client.vectorStores.search(vsId, {
      query,
      max_num_results: MAX_RESULTS,
      // Let the API turn the conversational phrasing into a search query.
      // Off by default; the raw question is a poor query on its own.
      rewrite_query: true,
      ranking_options: { ranker: "auto", score_threshold: SCORE_THRESHOLD },
    } as any);
    const chunks: KbChunk[] = (res.data ?? [])
      .map((r: any) => ({
        text: (r.content ?? []).map((c: any) => c.text).join("\n"),
        source: r.filename ?? r.file_id ?? "knowledge-base",
        score: r.score,
      }))
      .filter((c: KbChunk) => (c.score ?? 0) >= SCORE_THRESHOLD);
    logRetrieval(query, res.data?.length ?? 0, chunks);
    return ok(chunks, "KnowledgeBase");
  } catch (e: unknown) {
    return fail("KnowledgeBase", e instanceof Error ? e.message : String(e));
  }
}
