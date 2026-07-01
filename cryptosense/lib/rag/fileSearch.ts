import "server-only";
import OpenAI from "openai";
import { ok, fail } from "@/lib/tools/http";
import type { ToolResult } from "@/lib/tools/types";

export type KbChunk = { text: string; source: string; score?: number };

let _client: OpenAI | null = null;
function getClient(): Pick<OpenAI, "responses"> {
  if (!_client) _client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _client;
}

export async function searchKnowledgeBase(
  query: string,
  client: Pick<OpenAI, "responses"> = getClient(),
): Promise<ToolResult<KbChunk[]>> {
  const vsId = process.env.OPENAI_VECTOR_STORE_ID;
  if (!vsId) return fail("KnowledgeBase", "vector store not configured");
  try {
    const res: any = await client.responses.create({
      model: "gpt-4o-mini",
      input: query,
      tools: [{ type: "file_search", vector_store_ids: [vsId], max_num_results: 5 }],
      include: ["file_search_call.results"],
    } as any);
    const call = (res.output ?? []).find((o: any) => o.type === "file_search_call");
    if (call && call.status && call.status !== "completed") {
      return fail("KnowledgeBase", `file_search_call status: ${call.status}`);
    }
    const chunks: KbChunk[] = (call?.results ?? []).map((r: any) => ({
      text: r.text ?? (r.content ?? []).map((c: any) => c.text).join("\n"),
      source: r.filename ?? r.file_id ?? "knowledge-base",
      score: r.score,
    }));
    return ok(chunks, "KnowledgeBase");
  } catch (e: unknown) {
    return fail("KnowledgeBase", e instanceof Error ? e.message : String(e));
  }
}
