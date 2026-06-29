import "server-only";
import { ok, fail, cachedFetch } from "./http";
import type { ToolResult } from "./types";

export type NewsItem = { title: string; url: string; publishedAt: string; sentiment: "positive" | "negative" | "neutral" };

function sentimentFromVotes(v: any): NewsItem["sentiment"] {
  const pos = v?.positive ?? 0, neg = v?.negative ?? 0;
  return pos > neg ? "positive" : neg > pos ? "negative" : "neutral";
}

export async function getCryptoNews(symbol?: string): Promise<ToolResult<NewsItem[]>> {
  try {
    const token = process.env.CRYPTOPANIC_TOKEN ?? "";
    const cur = symbol ? `&currencies=${encodeURIComponent(symbol)}` : "";
    // developer v2（依據：CryptoPanic 研究）
    const j = await cachedFetch(`https://cryptopanic.com/api/developer/v2/posts/?auth_token=${token}&public=true${cur}`, { ttlMs: 1_200_000 });
    const data: NewsItem[] = (j.results ?? []).slice(0, 8).map((p: any) => ({
      title: p.title, url: p.url, publishedAt: p.published_at, sentiment: sentimentFromVotes(p.votes),
    }));
    return ok(data, "CryptoPanic");
  } catch (e: any) { return fail("CryptoPanic", e.message); }
}
