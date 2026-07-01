import "server-only";
import { ok, fail, cachedFetch } from "./http";
import type { ToolResult } from "./types";

export type CoinData = {
  id: string; symbol: string; name: string; image: string; marketCapRank: number;
  price: number; change24h: number; change7d: number;
  marketCap: number; volume24h: number; circulatingSupply: number; spark7d: number[];
};

const CG = "https://api.coingecko.com/api/v3";
const cgHeaders = () => (process.env.COINGECKO_DEMO_KEY ? { "x-cg-demo-api-key": process.env.COINGECKO_DEMO_KEY } : undefined);

export async function getCoinData(id: string): Promise<ToolResult<CoinData>> {
  try {
    const j = await cachedFetch(`${CG}/coins/${id}?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false&sparkline=true`, { ttlMs: 180_000, headers: cgHeaders() });
    const m = j.market_data;
    return ok({
      id: j.id, symbol: String(j.symbol).toUpperCase(), name: j.name,
      image: j.image?.small ?? j.image?.thumb ?? "", marketCapRank: j.market_cap_rank ?? 0,
      price: m.current_price.usd, change24h: m.price_change_percentage_24h ?? 0,
      change7d: m.price_change_percentage_7d ?? 0,
      marketCap: m.market_cap.usd, volume24h: m.total_volume.usd, circulatingSupply: m.circulating_supply,
      spark7d: m.sparkline_7d?.price ?? [],
    }, "CoinGecko");
  } catch (e: any) { return fail("CoinGecko", e.message); }
}
