import "server-only";
import { XMLParser } from "fast-xml-parser";
import { ok, fail, cachedText } from "./http";
import type { ToolResult } from "./types";

// P1 移除 sentiment 欄位；情緒改由 AI 依標題判讀
export type NewsItem = { title: string; url: string; publishedAt: string };

const parser = new XMLParser({ ignoreAttributes: false });

export async function getCryptoNews(
  // P1 用總體 feed；per-coin 過濾留 P1.x
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  symbol?: string,
): Promise<ToolResult<NewsItem[]>> {
  try {
    const xml = await cachedText("https://cointelegraph.com/rss", {
      ttlMs: 1_200_000,
      headers: { accept: "application/rss+xml, text/xml" },
    });
    const parsed = parser.parse(xml);
    const rawItems = parsed?.rss?.channel?.item ?? [];
    // 單筆時 fast-xml-parser 回物件而非陣列，需 normalize
    const items: any[] = Array.isArray(rawItems) ? rawItems : [rawItems];
    const data: NewsItem[] = items.slice(0, 8).map((item: any) => ({
      title: String(item.title ?? ""),
      url: String(item.link ?? ""),
      publishedAt: String(item.pubDate ?? ""),
    }));
    return ok(data, "CoinTelegraph");
  } catch (e: any) {
    return fail("CoinTelegraph", e.message);
  }
}
