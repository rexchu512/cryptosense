import "server-only";
import OpenAI from "openai";
import { ok, fail } from "@/lib/tools/http";
import type { ToolResult } from "@/lib/tools/types";

let _defaultClient: OpenAI | undefined;
function getDefaultClient(): OpenAI {
  if (!_defaultClient) {
    _defaultClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _defaultClient;
}

export type KbChunk = { text: string; source: string };

export async function searchKnowledgeBase(
  query: string,
  client: Pick<OpenAI, "vectorStores"> = getDefaultClient(),
): Promise<ToolResult<KbChunk[]>> {
  const vsId = process.env.OPENAI_VECTOR_STORE_ID;
  if (!vsId) return fail("KnowledgeBase", "vector store not configured");
  try {
    const res = await client.vectorStores.search(vsId, {
      query,
      max_num_results: 5,
    });
    const chunks: KbChunk[] = (res.data ?? []).map((r) => ({
      text: (r.content ?? []).map((c) => c.text).join("\n"),
      source: r.filename ?? r.file_id ?? "knowledge-base",
    }));
    return ok(chunks, "KnowledgeBase");
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return fail("KnowledgeBase", message);
  }
}
