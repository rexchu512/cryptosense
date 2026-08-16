import "server-only";
import { ok, fail } from "./http";
import type { ToolResult } from "./types";
import { getUsdtPairs } from "./binanceSymbols";
import { getOHLCV, type Candle } from "./ohlcv";
import { getDailyCloses } from "./cgSeries";
import { calcTechnicalSignals, type Signals } from "./indicators";

export type SeriesPoint = {
  time: number; close: number;
  open?: number; high?: number; low?: number; volume?: number;
};

export type PriceSeries = {
  kind: "candles" | "line";
  source: "Binance" | "CoinGecko";
  pair?: string;
  points: SeriesPoint[];
  signals: Signals[];
  /** 設定時代表這是因為 Binance 上游故障（不是這個幣真的沒有交易對）才退回折線圖。
   *  價格撞名防呆觸發的退回不算——那種情況是刻意不區分的，見設計文件 4.2 節。 */
  degraded?: "binance-unavailable";
};

export type SeriesInput = {
  coinId: string; symbol: string; spotPrice: number; isStablecoin: boolean;
};

/** 畫面只顯示 90 根，但指標用完整 250 根計算，MA200 才算得出來，
 *  而且 RSI／MACD 的暖機誤差不會出現在畫面上。 */
const DISPLAY = 90;

/** 日 K 收盤與即時報價本來就有時間差，加上交易所價差，正常不會超過幾個百分點。
 *  10% 足以擋掉代號撞名，又不會誤殺正常波動。上線後看紀錄再調。 */
const PRICE_TOLERANCE = 0.10;

function window(points: SeriesPoint[], signals: Signals[]) {
  return { points: points.slice(-DISPLAY), signals: signals.slice(-DISPLAY) };
}

export async function getPriceSeries(input: SeriesInput): Promise<ToolResult<PriceSeries>> {
  const { coinId, symbol, spotPrice, isStablecoin } = input;

  // 穩定幣不畫圖，而且要在花掉任何上游請求之前就擋下來。
  if (isStablecoin) {
    return { ...fail<PriceSeries>("PriceSeries", "stablecoin"), code: "unlisted" };
  }

  // 追蹤是不是 Binance 上游故障（451/429/5xx）害我們退到第二層，而不是這個幣
  // 真的沒有交易對。兩者混在一起，功能壞掉會偽裝成「這個幣本來就沒有」，
  // 沒有人會發現——見設計文件第 8 節。
  let binanceUnavailable = false;

  const pairs = await getUsdtPairs();
  if (pairs.code === "unavailable") {
    binanceUnavailable = true;
    console.warn(`[chart] ${coinId} Binance 交易對清單暫時無法取得，改用折線`);
  }
  if (pairs.data?.has(symbol.toUpperCase())) {
    const k = await getOHLCV(symbol);
    if (k.code === "unavailable") {
      binanceUnavailable = true;
      console.warn(`[chart] ${coinId} Binance 日 K 暫時無法取得，改用折線`);
    }
    const candles: Candle[] = k.data?.candles ?? [];
    if (candles.length) {
      const last = candles.at(-1)!.close;
      // 代號撞名防呆：Binance 的價格與這個幣的現價差太多，代表配對到別的幣。
      // 顯示錯的圖比不顯示更糟，因為使用者不會發現。
      const drift = Math.abs(last - spotPrice) / spotPrice;
      if (spotPrice > 0 && drift <= PRICE_TOLERANCE) {
        const points: SeriesPoint[] = candles.map((c) => ({
          time: c.time, close: c.close, open: c.open, high: c.high, low: c.low, volume: c.volume,
        }));
        const w = window(points, calcTechnicalSignals(candles));
        return ok({ kind: "candles" as const, source: "Binance" as const, pair: k.data!.pair, ...w }, "Binance");
      }
      // spotPrice 缺失時（路由把缺值映成 0）drift 沒有意義，不算真的撞名，
      // 不要記一筆假的碰撞——這是驗價紀錄唯一的資料來源，紀錄要乾淨。
      if (spotPrice > 0) {
        console.warn(`[chart] ${coinId} 配對 ${k.data?.pair} 價格不符（Binance ${last} vs 現價 ${spotPrice}），改用折線`);
      }
    }
  }

  const cg = await getDailyCloses(coinId);
  if (!cg.data?.length) {
    return { ...fail<PriceSeries>("CoinGecko", cg.error ?? "no data"), code: cg.code ?? "unlisted" };
  }
  // 折線層沒有開高低收，就不要編造。指標只吃收盤價，本來就夠。
  const asCandles: Candle[] = cg.data.map((p) => ({
    time: p.time, open: p.close, high: p.close, low: p.close, close: p.close, volume: 0,
  }));
  const points: SeriesPoint[] = cg.data.map((p) => ({ time: p.time, close: p.close }));
  const w = window(points, calcTechnicalSignals(asCandles));
  const line: PriceSeries = { kind: "line", source: "CoinGecko", ...w };
  if (binanceUnavailable) line.degraded = "binance-unavailable";
  return ok(line, "CoinGecko");
}
