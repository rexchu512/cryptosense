import { tool } from "ai";
import { z } from "zod";
import { getCoinData } from "@/lib/tools/coin";
import { getCryptoNews } from "@/lib/tools/news";
import { searchKnowledgeBase } from "@/lib/rag/fileSearch";
import { fail } from "@/lib/tools/http";
import type { createSourceRegistry } from "./sources";

type Registry = ReturnType<typeof createSourceRegistry>;

export function makeCryptoTools(
  ctx: { coinId?: string; symbol?: string },
  registry?: Registry,
) {
  const reg = registry;
  return {
    getCoinData: tool({
      description: "取得幣的即時行情（價格/24h漲跌/市值/量）。省略 id 時取當前幣；可帶其他 id（如 bitcoin）做對照。",
      inputSchema: z.object({ id: z.string().optional().describe("CoinGecko id；省略=當前幣") }),
      execute: async ({ id }) => {
        const target = id ?? ctx.coinId;
        if (!target) return fail("CoinGecko", "no coin specified");
        const r = await getCoinData(target);
        if (r.data && reg) {
          const s = reg.add({
            kind: "market", title: `${r.data.name} 市場資料快照`,
            url: `https://www.coingecko.com/en/coins/${r.data.id}`,
            meta: `CoinGecko · ${r.timestamp} · Powered by CoinGecko API`,
          });
          return { ...r, sources: [s] };
        }
        return r;
      },
    }),
    getCryptoNews: tool({
      description: "取得近期加密新聞標題（總體 feed；情緒由你依標題判讀）。",
      inputSchema: z.object({}),
      execute: async () => {
        const r = await getCryptoNews(ctx.symbol);
        if (r.data && reg) {
          const sources = r.data.slice(0, 2).map((n) =>
            reg.add({ kind: "news", title: n.title, url: n.url, meta: `CoinTelegraph · ${n.publishedAt}` }),
          );
          return { ...r, sources };
        }
        return r;
      },
    }),
    searchKnowledgeBase: tool({
      description: "檢索使用者個人知識庫（自有筆記），回傳帶來源的片段；檢索以當前幣為標的。",
      inputSchema: z.object({ query: z.string() }),
      execute: async function* ({ query }) {
        yield { status: "searching" as const };
        const result = await searchKnowledgeBase(`${ctx.symbol ?? ""} ${query}`.trim());
        const sources = (result.data ?? []).map((c) =>
          reg
            ? reg.add({
                kind: "kb" as const,
                title: c.source,
                meta: `個人筆記 · 相似度 ${(c.score ?? 0).toFixed(2)}`,
                snippet: c.text?.slice(0, 500),
              })
            : null,
        ).filter(Boolean);
        yield { status: "done" as const, ...result, sources };
      },
    }),
  };
}
