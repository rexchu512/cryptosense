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
      max_num_results: 3,
      ranking_options: { ranker: "auto", score_threshold: SCORE_THRESHOLD },
    } as any);
    const chunks: KbChunk[] = (res.data ?? [])
      .map((r: any) => ({
        text: (r.content ?? []).map((c: any) => c.text).join("\n"),
        source: r.filename ?? r.file_id ?? "knowledge-base",
        score: r.score,
      }))
      .filter((c: KbChunk) => (c.score ?? 0) >= SCORE_THRESHOLD);
    return ok(chunks, "KnowledgeBase");
  } catch (e: unknown) {
    return fail("KnowledgeBase", e instanceof Error ? e.message : String(e));
  }
}
