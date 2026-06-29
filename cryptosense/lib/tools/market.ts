import "server-only";
import { ok, fail, cachedFetch } from "./http";
import type { ToolResult } from "./types";

export type MarketCoin = { id: string; symbol: string; name: string; price: number; change24h: number; marketCap: number; spark7d: number[] };
export type MarketOverview = { totalMarketCap: number; totalVolume: number; btcDominance: number; coins: MarketCoin[] };
export type FearGreed = { value: number; label: string };

const CG = "https://api.coingecko.com/api/v3";
const cgHeaders = () => (process.env.COINGECKO_DEMO_KEY ? { "x-cg-demo-api-key": process.env.COINGECKO_DEMO_KEY } : undefined);

export async function getMarketOverview(): Promise<ToolResult<MarketOverview>> {
  try {
    const [markets, global] = await Promise.all([
      cachedFetch(`${CG}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=25&page=1&sparkline=true&price_change_percentage=24h`, { ttlMs: 90_000, headers: cgHeaders() }),
      cachedFetch(`${CG}/global`, { ttlMs: 300_000, headers: cgHeaders() }),
    ]);
    const coins: MarketCoin[] = markets.map((m: any) => ({
      id: m.id, symbol: String(m.symbol).toUpperCase(), name: m.name,
      price: m.current_price, change24h: m.price_change_percentage_24h ?? 0,
      marketCap: m.market_cap, spark7d: m.sparkline_in_7d?.price ?? [],
    }));
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
