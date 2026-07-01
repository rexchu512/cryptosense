import "server-only";
import { ok, fail, cachedFetch } from "./http";
import type { ToolResult } from "./types";

export type CoinSearchResult = { id: string; symbol: string; name: string; image: string };

const CG = "https://api.coingecko.com/api/v3";
const cgHeaders = () => (process.env.COINGECKO_DEMO_KEY ? { "x-cg-demo-api-key": process.env.COINGECKO_DEMO_KEY } : undefined);

export async function searchCoins(query: string): Promise<ToolResult<CoinSearchResult[]>> {
  const q = query.trim();
  if (!q) return ok([], "CoinGecko");
  try {
    const j = await cachedFetch(`${CG}/search?query=${encodeURIComponent(q)}`, { ttlMs: 60_000, headers: cgHeaders() });
    const coins: CoinSearchResult[] = (j.coins ?? []).slice(0, 8).map((c: any) => ({
      id: c.id, symbol: String(c.symbol).toUpperCase(), name: c.name, image: c.thumb ?? c.large ?? "",
    }));
    return ok(coins, "CoinGecko");
  } catch (e: any) { return fail("CoinGecko", e.message); }
}
