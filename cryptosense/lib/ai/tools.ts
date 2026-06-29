import { tool } from "ai";
import { z } from "zod";
import { getCoinData } from "@/lib/tools/coin";
import { getCryptoNews } from "@/lib/tools/news";
import { searchKnowledgeBase } from "@/lib/rag/fileSearch";

export const cryptoTools = {
  getCoinData: tool({
    description: "取得某幣的即時行情（價格、24h 漲跌、市值、成交量、流通量）",
    inputSchema: z.object({ id: z.string().describe("CoinGecko id, 如 ethereum") }),
    execute: async ({ id }) => getCoinData(id),
  }),
  getCryptoNews: tool({
    description: "取得某幣近期新聞與情緒（利多/利空/中性）",
    inputSchema: z.object({ symbol: z.string().describe("幣符號如 ETH") }),
    execute: async ({ symbol }) => getCryptoNews(symbol),
  }),
  searchKnowledgeBase: tool({
    description: "檢索使用者的個人知識庫（自有筆記/對話），回傳帶來源的片段",
    inputSchema: z.object({ query: z.string() }),
    execute: async ({ query }) => searchKnowledgeBase(query),
  }),
};
