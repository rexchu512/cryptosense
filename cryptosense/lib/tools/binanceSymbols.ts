import "server-only";
import { ok, fail, cachedFetch } from "./http";
import type { ToolResult } from "./types";

const BINANCE = "https://api.binance.com/api/v3";

/** 上架下架很少見，清單快取 24 小時。 */
const TTL_MS = 24 * 60 * 60 * 1000;

/**
 * 回傳「有 USDT 現貨對且正在交易」的基礎資產代號集合。
 *
 * 實測：加上 USDC／FDUSD／BTC 等其他計價幣，對市值前 250 名的涵蓋率
 * 完全沒有提升（都是 119 個）。有交易對的幣幾乎都有 USDT 對，
 * 所以這裡只認 USDT，不要為了「以防萬一」把邏輯複雜化。
 */
export async function getUsdtPairs(): Promise<ToolResult<Set<string>>> {
  try {
    const j = await cachedFetch(`${BINANCE}/exchangeInfo`, { ttlMs: TTL_MS });
    const set = new Set<string>();
    for (const s of j.symbols ?? []) {
      if (s.quoteAsset === "USDT" && s.status === "TRADING" && s.isSpotTradingAllowed) {
        set.add(s.baseAsset);
      }
    }
    return ok(set, "Binance");
  } catch (e: any) {
    // 空集合會被上游當成「所有幣都沒有交易對」，於是全部退到第二層，
    // 把 CoinGecko 的額度一次燒光。必須明確回報故障。
    return { ...fail<Set<string>>("Binance", e.message), code: "unavailable" };
  }
}
