import "server-only";
import { ok, fail, cachedFetch } from "./http";
import type { ToolResult } from "./types";

export type Candle = {
  /** K 線開盤時間，Unix 毫秒。Binance 的日 K 邊界是 UTC。 */
  time: number;
  open: number; high: number; low: number; close: number; volume: number;
};

/** Binance 而不是 CoinGecko：免費層的 CoinGecko 拿不到 90 天日 K，
 *  會自動改成 4 天一根，MA50/MA200 算不出來、RSI 週期會變成 56 天。 */
const BINANCE = "https://api.binance.com/api/v3";

/** 日 K 一天只收一次，所以 6 小時快取不是偷懶，是符合資料本質。
 *  Binance 額度寬鬆不是瓶頸，但一致的快取策略讓兩層行為可預測。 */
const TTL_MS = 6 * 60 * 60 * 1000;

export async function getOHLCV(symbol: string): Promise<ToolResult<{ pair: string; candles: Candle[] }>> {
  const pair = `${symbol.toUpperCase()}USDT`;
  try {
    const rows: unknown[][] = await cachedFetch(
      `${BINANCE}/klines?symbol=${pair}&interval=1d&limit=300`,
      { ttlMs: TTL_MS },
    );
    const now = Date.now();
    const candles = rows
      // 最後一根通常還在形成中。用未收盤的 K 線算指標，RSI 會在 70/30 附近抖動。
      .filter((r) => Number(r[6]) < now)
      .map((r) => ({
        time: Number(r[0]),
        open: Number(r[1]), high: Number(r[2]), low: Number(r[3]),
        close: Number(r[4]), volume: Number(r[5]),
      }));
    return ok({ pair, candles }, "Binance");
  } catch (e: any) {
    // Binance 對不存在的交易對回 400（-1121 Invalid symbol）。那不是故障，
    // 是這個幣本來就沒有 USDT 現貨對。兩者混在一起畫面只能寫「暫無資料」，
    // 使用者無從分辨「這個幣沒有 K 線」和「功能壞了」。
    const status = Number(/HTTP (\d+)/.exec(String(e?.message))?.[1] ?? 0);
    const code = status === 400 ? "unlisted" : "unavailable";
    return { ...fail<{ pair: string; candles: Candle[] }>("Binance", e.message), code };
  }
}
