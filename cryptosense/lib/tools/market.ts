import "server-only";
import { ok, fail, cachedFetch } from "./http";
import type { ToolResult } from "./types";

export type MarketCoin = {
  id: string; symbol: string; name: string; image: string; marketCapRank: number;
  price: number; change1h: number; change24h: number; change7d: number;
  marketCap: number; spark7d: number[]; rankChange: "up" | "down" | "same" | null;
};
export type MarketOverview = { totalMarketCap: number; totalVolume: number; btcDominance: number; coins: MarketCoin[] };
export type FearGreed = { value: number; label: string };

const CG = "https://api.coingecko.com/api/v3";
const cgHeaders = () => (process.env.COINGECKO_DEMO_KEY ? { "x-cg-demo-api-key": process.env.COINGECKO_DEMO_KEY } : undefined);

/**
 * 排名變動：只跟「上一次成功抓到的資料」比較（記憶體內、隨伺服器行程存活）。
 * 這不是真正的「24 小時前排名」（CMC 用自家歷史快照算），P1.x 無 DB，
 * 這是唯一不需要持久化就能做到的近似版本；伺服器重啟或快取過期前的
 * 第一次呼叫一律回傳 null（沒有基準可比較）。
 */
const lastRanks = new Map<string, number>();
export function __clearRankHistory() { lastRanks.clear(); }
function rankChangeFor(id: string, rank: number): "up" | "down" | "same" | null {
  const prev = lastRanks.get(id);
  lastRanks.set(id, rank);
  if (prev === undefined) return null;
  if (rank < prev) return "up";
  if (rank > prev) return "down";
  return "same";
}

export async function getMarketOverview(): Promise<ToolResult<MarketOverview>> {
  try {
    const [markets, global] = await Promise.all([
      cachedFetch(`${CG}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=25&page=1&sparkline=true&price_change_percentage=1h,24h,7d`, { ttlMs: 90_000, headers: cgHeaders() }),
      cachedFetch(`${CG}/global`, { ttlMs: 300_000, headers: cgHeaders() }),
    ]);
    const coins: MarketCoin[] = markets.map((m: any) => {
      const marketCapRank = m.market_cap_rank ?? 0;
      return {
        id: m.id, symbol: String(m.symbol).toUpperCase(), name: m.name,
        image: m.image ?? "", marketCapRank,
        price: m.current_price, change24h: m.price_change_percentage_24h ?? 0,
        change1h: m.price_change_percentage_1h_in_currency ?? 0,
        change7d: m.price_change_percentage_7d_in_currency ?? 0,
        marketCap: m.market_cap, spark7d: m.sparkline_in_7d?.price ?? [],
        rankChange: rankChangeFor(m.id, marketCapRank),
      };
    });
    const g = global.data;
    return ok({ totalMarketCap: g.total_market_cap.usd, totalVolume: g.total_volume.usd, btcDominance: g.market_cap_percentage.btc, coins }, "CoinGecko");
  } catch (e: any) { return fail("CoinGecko", e.message); }
}

export async function getFearGreedIndex(): Promise<ToolResult<FearGreed>> {
  try {
    const j = await cachedFetch("https://api.alternative.me/fng/?limit=1", { ttlMs: 3_600_000 });
    const d = j.data[0];
    return ok({ value: Number(d.value), label: d.value_classification }, "Alternative.me");
  } catch (e: any) { return fail("Alternative.me", e.message); }
}
