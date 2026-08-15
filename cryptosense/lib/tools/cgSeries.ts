import "server-only";
import { ok, fail, cachedFetch } from "./http";
import type { ToolResult } from "./types";

export type ClosePoint = { time: number; close: number };

const CG = "https://api.coingecko.com/api/v3";
const cgHeaders = () =>
  process.env.COINGECKO_DEMO_KEY ? { "x-cg-demo-api-key": process.env.COINGECKO_DEMO_KEY } : undefined;

/** 日資料一天只變一次，所以 6 小時快取不是偷懶，是符合資料本質。
 *  CoinGecko 免費層是本功能唯一的額度瓶頸（實測連續 4 次請求就被限流）。 */
const TTL_MS = 6 * 60 * 60 * 1000;

/** 抓 250 天，指標算完只顯示 90 天。MA200 需要 200 個點。 */
const DAYS = 250;

/**
 * CoinGecko 的 /ohlc 端點在免費層一律回「4 天一根」，不論 days 帶 90／180／365，
 * MA50／MA200 根本算不出來。所以這裡改用 market_chart 拿每日收盤價：
 * 只有收盤價，但 RSI／MACD／MA 本來就只吃收盤價，夠用。
 */
export async function getDailyCloses(coinId: string): Promise<ToolResult<ClosePoint[]>> {
  try {
    const j = await cachedFetch(
      `${CG}/coins/${coinId}/market_chart?vs_currency=usd&days=${DAYS}`,
      { ttlMs: TTL_MS, headers: cgHeaders() },
    );
    const now = Date.now();
    const startOfToday = Math.floor(now / 86_400_000) * 86_400_000;
    const points: ClosePoint[] = (j.prices ?? [])
      .map((p: [number, number]) => ({ time: p[0], close: p[1] }))
      // 最後一個點是今天還在變動的價格。留著的話 RSI 會在 70/30 附近抖動，
      // 看起來像出現了交易訊號。
      .filter((p: ClosePoint) => p.time < startOfToday);
    return ok(points, "CoinGecko");
  } catch (e: any) {
    return { ...fail<ClosePoint[]>("CoinGecko", e.message), code: "unavailable" };
  }
}
