// @vitest-environment node
import { describe, it, expect } from "vitest";
import { calcTechnicalSignals } from "./indicators";
import type { Candle } from "./ohlcv";

const DAY = 86_400_000;
const T0 = Date.UTC(2026, 0, 1);

function candles(closes: number[]): Candle[] {
  return closes.map((c, i) => ({
    time: T0 + i * DAY,
    open: c, high: c + 1, low: c - 1, close: c, volume: 100,
  }));
}

/** Wilder RSI 的標準驗證序列，第一個 RSI(14) 應為 70.53。
 *  用它才能證明我們用的是 Wilder 平滑（α=1/n），不是 EMA（α=2/(n+1)）。
 *
 *  小數位數不能省。四捨五入到兩位會讓答案變成 70.46，差 0.07 —— 看起來像
 *  程式算錯，其實是測試資料的精度不夠。 */
const WILDER_CLOSES = [
  44.3389, 44.0902, 44.1497, 43.6124, 44.3278, 44.8264, 45.0955, 45.4245, 45.8433, 46.0826,
  45.8931, 46.0328, 45.6140, 46.2820, 46.2820, 46.0028, 46.0328, 46.4116, 46.2223, 45.6439,
];

describe("calcTechnicalSignals", () => {
  it("leaves RSI empty during the warm-up window instead of emitting a half-formed value", () => {
    const out = calcTechnicalSignals(candles(WILDER_CLOSES));

    // RSI(14) 需要 15 根 K 線才有第一個值：14 個變化量要 15 個收盤價
    expect(out.slice(0, 14).every((s) => s.rsi14 === undefined)).toBe(true);
    expect(out[14].rsi14).toBeDefined();
  });

  it("matches Wilder's published RSI, proving it is not EMA-smoothed", () => {
    const out = calcTechnicalSignals(candles(WILDER_CLOSES));

    // 換成 EMA 平滑（α=2/15）這個數字會明顯偏離，測試就會擋下來
    expect(out[14].rsi14).toBeCloseTo(70.53, 1);
  });

  it("withholds MACD until the signal line has enough data", () => {
    // MACD(12,26,9)：MACD 線要 26 根，訊號線還要再 9 個 MACD 值，
    // 合計 34 根才有完整結果。比 RSI 的 15 根長得多，最容易漏掉。
    const ramp = Array.from({ length: 40 }, (_, i) => 100 + Math.sin(i / 3) * 5 + i * 0.2);
    const out = calcTechnicalSignals(candles(ramp));

    expect(out.slice(0, 33).every((s) => s.macd === undefined)).toBe(true);
    expect(out[33].macd).toBeDefined();
    expect(out[33].macd).toHaveProperty("signal");
    expect(out[33].macd).toHaveProperty("histogram");
  });

  it("computes MA50 and MA200 only once each has a full window", () => {
    const closes = Array.from({ length: 210 }, (_, i) => 100 + i);
    const out = calcTechnicalSignals(candles(closes));

    expect(out[48].ma50).toBeUndefined();
    expect(out[49].ma50).toBeCloseTo(124.5, 6); // 100..149 的平均
    expect(out[198].ma200).toBeUndefined();
    expect(out[199].ma200).toBeCloseTo(199.5, 6); // 100..299 的平均
  });

  it("keeps every signal aligned to its candle timestamp", () => {
    const cs = candles(WILDER_CLOSES);
    const out = calcTechnicalSignals(cs);

    // 指標陣列比輸入短是常見錯誤來源。這裡保證輸出與輸入等長且逐筆對齊時間，
    // 下游才不會用索引硬對，把指標接到錯誤的日期上。
    expect(out).toHaveLength(cs.length);
    expect(out.map((s) => s.time)).toEqual(cs.map((c) => c.time));
  });
});
