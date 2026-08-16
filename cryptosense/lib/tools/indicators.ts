import { RSI, MACD, EMA, SMA } from "trading-signals";
import type { Candle } from "./ohlcv";

export type MacdValue = { macd: number; signal: number; histogram: number };

export type Signals = {
  /** 對應 K 線的開盤時間。指標一律用時間戳對齊，不要用陣列索引。 */
  time: number;
  rsi14?: number;
  macd?: MacdValue;
  ma50?: number;
  ma200?: number;
};

/**
 * MACD(12,26,9) 要 34 根才有真正的訊號線：26 根給 MACD 線，再 9 個 MACD 值給訊號線。
 *
 * 不能相信 `macd.getRequiredInputs()` —— 它回傳 26，只算了 MACD 線。
 * 第 26 根時訊號線只吃到一個 MACD 值，會被那個值播種，於是
 * `signal === macd`、`histogram === 0`。那是一條假的訊號線，不是中性訊號，
 * 而且不會有任何警告。實測 i=25 到 i=32 都落在這個區間。
 */
const MACD_WARMUP = 34;

export function calcTechnicalSignals(candles: Candle[]): Signals[] {
  // RSI 用 Wilder 平滑（α=1/n），不是 EMA（α=2/(n+1)）。
  // trading-signals 的 RSI 預設就是 WSMA，也就是 Wilder。搞混會得到
  // 「看起來對、其實錯」的數字，而且不會有任何錯誤訊息。
  const rsi = new RSI(14);
  // MACD 相反，三條線都是 EMA（α=2/(n+1)）。
  const macd = new MACD(new EMA(12), new EMA(26), new EMA(9));
  // MA200 需要 200 根。這是當初選 Binance 而不是 CoinGecko 的原因：
  // CoinGecko 免費層拿不到 90 天日 K，會自動給 4 天一根，MA200 根本算不出來。
  const ma50 = new SMA(50);
  const ma200 = new SMA(200);

  return candles.map((c, i) => {
    // 暖機期回 null，代表「還算不出來」。轉成 undefined，不要填 0 —— 填 0 會被
    // 下游當成「RSI 等於 0」，在圖上畫出一條假的超賣線。
    const rsi14 = rsi.update(c.close, false) ?? undefined;
    const m = macd.update(c.close, false) ?? undefined;
    return {
      time: c.time,
      rsi14,
      macd: i + 1 >= MACD_WARMUP ? m : undefined,
      ma50: ma50.update(c.close, false) ?? undefined,
      ma200: ma200.update(c.close, false) ?? undefined,
    };
  });
}
