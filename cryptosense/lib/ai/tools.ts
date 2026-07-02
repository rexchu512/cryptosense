import { tool } from "ai";
import { z } from "zod";
import { getCoinData } from "@/lib/tools/coin";
import { getCryptoNews } from "@/lib/tools/news";
import { searchKnowledgeBase } from "@/lib/rag/fileSearch";
import { fail } from "@/lib/tools/http";

export function makeCryptoTools(ctx: { coinId?: string; symbol?: string }) {
  return {
    getCoinData: tool({
      description: "取得幣的即時行情（價格/24h漲跌/市值/量）。省略 id 時取當前幣；可帶其他 id（如 bitcoin）做對照。",
      inputSchema: z.object({ id: z.string().optional().describe("CoinGecko id；省略=當前幣") }),
      execute: async ({ id }) => {
        const target = id ?? ctx.coinId;
        return target ? getCoinData(target) : fail("CoinGecko", "no coin specified");
      },
    }),
    getCryptoNews: tool({
      description: "取得近期加密新聞標題（總體 feed；情緒由你依標題判讀）。",
      inputSchema: z.object({}),
      execute: async () => getCryptoNews(ctx.symbol),
    }),
    searchKnowledgeBase: tool({
      description: "檢索使用者個人知識庫（自有筆記），回傳帶來源的片段；檢索以當前幣為標的。",
      inputSchema: z.object({ query: z.string() }),
      execute: async function* ({ query }) {
        yield { status: "searching" as const };
        const result = await searchKnowledgeBase(`${ctx.symbol ?? ""} ${query}`.trim());
        yield { status: "done" as const, ...result };
      },
    }),
  };
}
