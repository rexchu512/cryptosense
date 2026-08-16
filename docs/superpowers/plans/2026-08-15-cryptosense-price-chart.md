# CryptoSense K 線圖與技術指標 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 幣種頁面顯示 90 天價格走勢與四項技術指標，Binance 有交易對的畫 K 線，沒有的用 CoinGecko 每日收盤價畫折線，兩者都算指標。

**Architecture:** 兩層資料來源。Binance 日 K 為第一層，CoinGecko 每日收盤價為第二層。一個協調層負責選層、驗價防呆、視窗切割，透過一支 API 端點供前端取用。指標計算層已完成且有測試。

**Tech Stack:** Next.js 16 App Router、TypeScript、Vitest、`trading-signals` 8.3.0、TradingView Lightweight Charts。

**Spec:** `docs/superpowers/specs/2026-08-15-cryptosense-price-chart-design.md`

## Global Constraints

- 抓 **250** 根計算指標，畫面只顯示最後 **90** 根。
- 未收盤的最後一根一律丟棄，兩層都要做。
- 驗價門檻 **±10%**：Binance 收盤價與 CoinGecko 現價超過此差距即判定配對錯誤。
- 穩定幣判定**只**看 CoinGecko 分類欄位是否含 `"Stablecoins"`，不加其他推論規則。
- 快取：Binance 交易對清單 **24 小時**、Binance 日 K **6 小時**、CoinGecko 每日價格 **6 小時**。
- 指標**只顯示數字**，畫面上不得出現「超買」「超賣」「黃金交叉」等結論字樣。
- Dashboard（`components/MarketDashboard.tsx`、`Sparkline`）**不得修改**。
- 既有測試必須維持全綠，`npx tsc --noEmit` 必須乾淨。
- 所有測試檔第一行加 `// @vitest-environment node`（純邏輯）或 `jsdom`（元件）。

## 已完成（前置工作，不需重做）

- `lib/tools/ohlcv.ts` — Binance 日 K 抓取、丟棄未收盤、`code: "unlisted" | "unavailable"`
- `lib/tools/ohlcv.test.ts` — 3 個測試
- `lib/tools/indicators.ts` — `calcTechnicalSignals()`，RSI(14 Wilder)／MACD(12,26,9)／MA50／MA200
- `lib/tools/indicators.test.ts` — 5 個測試（含 Wilder 基準值 70.53）
- `lib/tools/types.ts` — `ToolResult` 已加 `code` 欄位

## File Structure

| 檔案 | 職責 |
|---|---|
| `lib/tools/binanceSymbols.ts` | 取 Binance 現貨交易對清單，判斷某代號有無 USDT 對 |
| `lib/tools/cgSeries.ts` | 取 CoinGecko 每日收盤價，丟棄當日未完成的點 |
| `lib/tools/priceSeries.ts` | 協調層：選層、驗價、切視窗、組指標 |
| `app/api/price-series/[id]/route.ts` | 對外端點 |
| `components/PriceChartCanvas.tsx` | 只負責畫圖的畫布元件（lightweight-charts） |
| `components/PriceChartPanel.tsx` | 四種狀態、指標數值、載入骨架 |
| `components/CoinDetail.tsx` | 修改：以新面板取代 7 天走勢圖 |
| `lib/tools/coin.ts` | 修改：`CoinData` 增加 `isStablecoin` |

---

### Task 1: Binance 交易對清單

**Files:**
- Create: `cryptosense/lib/tools/binanceSymbols.ts`
- Test: `cryptosense/lib/tools/binanceSymbols.test.ts`

**Interfaces:**
- Consumes: `ok`/`fail`/`cachedFetch` from `./http`、`ToolResult` from `./types`
- Produces: `getUsdtPairs(): Promise<ToolResult<Set<string>>>`（Set 內容為基礎資產代號，如 `"BTC"`）

- [ ] **Step 1: 寫失敗測試**

```typescript
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { getUsdtPairs } from "./binanceSymbols";
import { __clearCache } from "./http";

beforeEach(() => __clearCache());

function stub(symbols: unknown[]) {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ symbols }) }));
}

describe("getUsdtPairs", () => {
  it("keeps only spot pairs that are trading and quoted in USDT", async () => {
    stub([
      { baseAsset: "BTC", quoteAsset: "USDT", status: "TRADING", isSpotTradingAllowed: true },
      { baseAsset: "OLD", quoteAsset: "USDT", status: "BREAK", isSpotTradingAllowed: true },
      { baseAsset: "MARGINONLY", quoteAsset: "USDT", status: "TRADING", isSpotTradingAllowed: false },
      { baseAsset: "ALT", quoteAsset: "BTC", status: "TRADING", isSpotTradingAllowed: true },
    ]);

    const r = await getUsdtPairs();

    expect(r.data?.has("BTC")).toBe(true);
    expect(r.data?.has("OLD")).toBe(false);
    expect(r.data?.has("MARGINONLY")).toBe(false);
    expect(r.data?.has("ALT")).toBe(false);
  });

  it("returns an error rather than an empty set when Binance is unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 503 }));

    const r = await getUsdtPairs();

    expect(r.data).toBeNull();
    expect(r.code).toBe("unavailable");
  });
});
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `cd cryptosense && npx vitest run lib/tools/binanceSymbols.test.ts`
Expected: FAIL — `Cannot find module './binanceSymbols'`

- [ ] **Step 3: 寫最小實作**

```typescript
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
```

- [ ] **Step 4: 執行測試確認通過**

Run: `cd cryptosense && npx vitest run lib/tools/binanceSymbols.test.ts`
Expected: PASS（2 個測試）

- [ ] **Step 5: 提交**

```bash
git add cryptosense/lib/tools/binanceSymbols.ts cryptosense/lib/tools/binanceSymbols.test.ts
git commit -m "feat(chart): resolve Binance USDT spot pairs with 24h cache"
```

---

### Task 2: CoinGecko 每日收盤價

**Files:**
- Create: `cryptosense/lib/tools/cgSeries.ts`
- Test: `cryptosense/lib/tools/cgSeries.test.ts`

**Interfaces:**
- Consumes: `ok`/`fail`/`cachedFetch` from `./http`
- Produces: `export type ClosePoint = { time: number; close: number }`、
  `getDailyCloses(coinId: string): Promise<ToolResult<ClosePoint[]>>`

- [ ] **Step 1: 寫失敗測試**

```typescript
// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getDailyCloses } from "./cgSeries";
import { __clearCache } from "./http";

const DAY = 86_400_000;
const T0 = Date.UTC(2026, 0, 1);

function stub(prices: [number, number][]) {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ prices }) }));
}

beforeEach(() => __clearCache());
afterEach(() => vi.useRealTimers());

describe("getDailyCloses", () => {
  it("drops the trailing partial day so today's moving price cannot skew indicators", async () => {
    vi.useFakeTimers();
    // 現在是第 3 天的中午 —— 第 3 個點是當日還在變動的價格
    vi.setSystemTime(new Date(T0 + 2 * DAY + DAY / 2));
    stub([[T0, 10], [T0 + DAY, 11], [T0 + 2 * DAY + DAY / 2, 12]]);

    const r = await getDailyCloses("monero");

    expect(r.data).toHaveLength(2);
    expect(r.data?.at(-1)).toEqual({ time: T0 + DAY, close: 11 });
  });

  it("reports rate limiting as an outage instead of as an empty series", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 429 }));

    const r = await getDailyCloses("monero");

    expect(r.data).toBeNull();
    expect(r.code).toBe("unavailable");
  });
});
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `cd cryptosense && npx vitest run lib/tools/cgSeries.test.ts`
Expected: FAIL — `Cannot find module './cgSeries'`

- [ ] **Step 3: 寫最小實作**

```typescript
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
```

- [ ] **Step 4: 執行測試確認通過**

Run: `cd cryptosense && npx vitest run lib/tools/cgSeries.test.ts`
Expected: PASS（2 個測試）

- [ ] **Step 5: 提交**

```bash
git add cryptosense/lib/tools/cgSeries.ts cryptosense/lib/tools/cgSeries.test.ts
git commit -m "feat(chart): fetch CoinGecko daily closes as the fallback series"
```

---

### Task 3: 幣種資料加上穩定幣旗標

**Files:**
- Modify: `cryptosense/lib/tools/coin.ts`
- Test: `cryptosense/lib/tools/coin.test.ts`（新增一個測試）

**Interfaces:**
- Produces: `CoinData` 新增欄位 `isStablecoin: boolean`

- [ ] **Step 1: 寫失敗測試（加在既有 describe 內）**

```typescript
  it("flags stablecoins from the CoinGecko category list", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({
      id: "tether", symbol: "usdt", name: "Tether", image: {}, market_cap_rank: 3,
      categories: ["Stablecoins", "USD Stablecoin", "Ethereum Ecosystem"],
      market_data: {
        current_price: { usd: 1 }, price_change_percentage_24h: 0, price_change_percentage_7d: 0,
        market_cap: { usd: 1 }, total_volume: { usd: 1 }, circulating_supply: 1,
      } }) }));
    const r = await getCoinData("tether");
    expect(r.data?.isStablecoin).toBe(true);
  });

  it("treats a coin with no category list as a normal coin", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({
      id: "monero", symbol: "xmr", name: "Monero", image: {}, market_cap_rank: 16,
      market_data: {
        current_price: { usd: 300 }, price_change_percentage_24h: 0, price_change_percentage_7d: 0,
        market_cap: { usd: 1 }, total_volume: { usd: 1 }, circulating_supply: 1,
      } }) }));
    const r = await getCoinData("monero");
    expect(r.data?.isStablecoin).toBe(false);
  });
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `cd cryptosense && npx vitest run lib/tools/coin.test.ts`
Expected: FAIL — `expected undefined to be true`

- [ ] **Step 3: 寫最小實作**

在 `lib/tools/coin.ts` 的 `CoinData` type 加一行：

```typescript
  circulatingSupply: number; spark7d: number[]; isStablecoin: boolean;
```

在 `ok({...})` 的物件內，`spark7d` 那一行後面加：

```typescript
      // 穩定幣價格釘在 1 美元，K 線與 RSI 沒有意義，畫出來反而誤導。
      // 只認分類標籤。不要改用「波動小於 x%」推論 —— 橫盤整理的一般幣
      // 會被誤判成穩定幣，而且發生時沒有任何跡象。
      isStablecoin: (j.categories ?? []).includes("Stablecoins"),
```

- [ ] **Step 4: 執行測試確認通過**

Run: `cd cryptosense && npx vitest run lib/tools/coin.test.ts`
Expected: PASS

- [ ] **Step 5: 修正型別**

Run: `cd cryptosense && npx tsc --noEmit`
若 `components/CoinDetail.test.tsx`、`lib/ai/tools.test.ts` 等測試夾具因缺欄位報錯，
在該夾具物件補 `isStablecoin: false`。

- [ ] **Step 6: 執行完整測試**

Run: `cd cryptosense && npm test`
Expected: 全綠

- [ ] **Step 7: 提交**

```bash
git add cryptosense/lib/tools/coin.ts cryptosense/lib/tools/coin.test.ts cryptosense/components/CoinDetail.test.tsx cryptosense/lib/ai/tools.test.ts
git commit -m "feat(chart): flag stablecoins so the chart can opt them out"
```

---

### Task 4: 協調層（選層、驗價、切視窗）

**Files:**
- Create: `cryptosense/lib/tools/priceSeries.ts`
- Test: `cryptosense/lib/tools/priceSeries.test.ts`

**Interfaces:**
- Consumes: `getUsdtPairs`（Task 1）、`getDailyCloses`＋`ClosePoint`（Task 2）、
  `getOHLCV`＋`Candle`（已完成）、`calcTechnicalSignals`＋`Signals`（已完成）
- Produces:
  ```typescript
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
  };
  export type SeriesInput = {
    coinId: string; symbol: string; spotPrice: number; isStablecoin: boolean;
  };
  export function getPriceSeries(input: SeriesInput): Promise<ToolResult<PriceSeries>>;
  ```
  失敗時 `code` 為 `"unlisted"`（穩定幣或兩層都沒資料）或 `"unavailable"`（服務故障）

- [ ] **Step 1: 寫失敗測試**

```typescript
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./binanceSymbols", () => ({ getUsdtPairs: vi.fn() }));
vi.mock("./ohlcv", () => ({ getOHLCV: vi.fn() }));
vi.mock("./cgSeries", () => ({ getDailyCloses: vi.fn() }));

import { getPriceSeries } from "./priceSeries";
import { getUsdtPairs } from "./binanceSymbols";
import { getOHLCV } from "./ohlcv";
import { getDailyCloses } from "./cgSeries";

const mockPairs = vi.mocked(getUsdtPairs);
const mockOHLCV = vi.mocked(getOHLCV);
const mockCG = vi.mocked(getDailyCloses);

const DAY = 86_400_000;
const T0 = Date.UTC(2025, 0, 1);

function candles(n: number, price = 100) {
  return Array.from({ length: n }, (_, i) => ({
    time: T0 + i * DAY, open: price, high: price + 1, low: price - 1, close: price, volume: 1,
  }));
}
function closes(n: number, price = 100) {
  return Array.from({ length: n }, (_, i) => ({ time: T0 + i * DAY, close: price }));
}
const base = { coinId: "bitcoin", symbol: "BTC", spotPrice: 100, isStablecoin: false };

beforeEach(() => {
  mockPairs.mockResolvedValue({ data: new Set(["BTC"]), source: "Binance", timestamp: "t" } as any);
  mockOHLCV.mockResolvedValue({ data: { pair: "BTCUSDT", candles: candles(250) }, source: "Binance", timestamp: "t" } as any);
  mockCG.mockResolvedValue({ data: closes(250), source: "CoinGecko", timestamp: "t" } as any);
});

describe("getPriceSeries", () => {
  it("uses Binance candles when the pair exists and the price agrees", async () => {
    const r = await getPriceSeries(base);

    expect(r.data?.kind).toBe("candles");
    expect(r.data?.source).toBe("Binance");
    expect(r.data?.pair).toBe("BTCUSDT");
  });

  it("shows only the last 90 points while computing indicators over the full history", async () => {
    const r = await getPriceSeries(base);

    expect(r.data?.points).toHaveLength(90);
    expect(r.data?.signals).toHaveLength(90);
    // MA200 需要 200 根。若指標只用顯示視窗的 90 根計算，這裡會是 undefined。
    expect(r.data?.signals.at(-1)?.ma200).toBeDefined();
    // 指標必須與顯示點逐筆對齊
    expect(r.data?.signals.map((s) => s.time)).toEqual(r.data?.points.map((p) => p.time));
  });

  it("falls back to the line series when Binance's price disagrees with the spot price", async () => {
    // 代號撞名：Binance 的 BTCUSDT 是比特幣，但這個幣現價只有 0.5 美元
    const r = await getPriceSeries({ ...base, spotPrice: 0.5 });

    expect(r.data?.kind).toBe("line");
    expect(r.data?.source).toBe("CoinGecko");
  });

  it("uses the line series when the coin has no Binance pair", async () => {
    mockPairs.mockResolvedValue({ data: new Set<string>(), source: "Binance", timestamp: "t" } as any);

    const r = await getPriceSeries({ ...base, symbol: "XMR" });

    expect(r.data?.kind).toBe("line");
    expect(r.data?.signals.at(-1)?.rsi14).toBeDefined();
  });

  it("refuses stablecoins before spending any upstream request", async () => {
    const r = await getPriceSeries({ ...base, symbol: "USDT", isStablecoin: true });

    expect(r.data).toBeNull();
    expect(r.code).toBe("unlisted");
    expect(mockPairs).not.toHaveBeenCalled();
    expect(mockCG).not.toHaveBeenCalled();
  });

  it("separates an upstream outage from a coin that simply has no data", async () => {
    mockPairs.mockResolvedValue({ data: new Set<string>(), source: "Binance", timestamp: "t" } as any);
    mockCG.mockResolvedValue({ data: null, source: "CoinGecko", timestamp: "t", error: "HTTP 429", code: "unavailable" } as any);

    const r = await getPriceSeries({ ...base, symbol: "XMR" });

    expect(r.data).toBeNull();
    expect(r.code).toBe("unavailable");
  });
});
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `cd cryptosense && npx vitest run lib/tools/priceSeries.test.ts`
Expected: FAIL — `Cannot find module './priceSeries'`

- [ ] **Step 3: 寫最小實作**

```typescript
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

  const pairs = await getUsdtPairs();
  if (pairs.data?.has(symbol.toUpperCase())) {
    const k = await getOHLCV(symbol);
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
      console.warn(`[chart] ${coinId} 配對 ${k.data?.pair} 價格不符（Binance ${last} vs 現價 ${spotPrice}），改用折線`);
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
  return ok({ kind: "line" as const, source: "CoinGecko" as const, ...w }, "CoinGecko");
}
```

- [ ] **Step 4: 執行測試確認通過**

Run: `cd cryptosense && npx vitest run lib/tools/priceSeries.test.ts`
Expected: PASS（6 個測試）

- [ ] **Step 5: 提交**

```bash
git add cryptosense/lib/tools/priceSeries.ts cryptosense/lib/tools/priceSeries.test.ts
git commit -m "feat(chart): tier Binance candles over CoinGecko line with price sanity check"
```

---

### Task 5: API 端點

**Files:**
- Create: `cryptosense/app/api/price-series/[id]/route.ts`
- Test: `cryptosense/app/api/price-series/[id]/route.test.ts`

**Interfaces:**
- Consumes: `getPriceSeries`（Task 4）
- Produces: `GET /api/price-series/<coinId>?symbol=BTC&spot=67000&stable=0`
  回傳 `getPriceSeries` 的 `ToolResult` JSON

**驗價用的現價由前端帶入，不在伺服器端重新請求。** 頁面本來就有這筆資料，
再打一次 CoinGecko 會平白消耗額度，而額度正是第二層的瓶頸。
這裡沒有安全邊界 —— 這個值只用於自我防呆，不涉及授權。

- [ ] **Step 1: 寫失敗測試**

```typescript
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/tools/priceSeries", () => ({ getPriceSeries: vi.fn() }));

import { GET } from "./route";
import { getPriceSeries } from "@/lib/tools/priceSeries";

const mockSeries = vi.mocked(getPriceSeries);

beforeEach(() => {
  mockSeries.mockResolvedValue({
    data: { kind: "candles", source: "Binance", pair: "BTCUSDT", points: [], signals: [] },
    source: "Binance", timestamp: "t",
  } as any);
});

function call(url: string, id = "bitcoin") {
  return GET(new Request(url), { params: Promise.resolve({ id }) });
}

describe("GET /api/price-series/[id]", () => {
  it("passes the coin id and query parameters through to the series builder", async () => {
    const res = await call("http://x/api/price-series/bitcoin?symbol=BTC&spot=67000&stable=0");
    const body = await res.json();

    expect(mockSeries).toHaveBeenCalledWith({
      coinId: "bitcoin", symbol: "BTC", spotPrice: 67000, isStablecoin: false,
    });
    expect(body.data.kind).toBe("candles");
  });

  it("reads stable=1 as a stablecoin", async () => {
    await call("http://x/api/price-series/tether?symbol=USDT&spot=1&stable=1", "tether");

    expect(mockSeries).toHaveBeenCalledWith(
      expect.objectContaining({ isStablecoin: true }),
    );
  });

  it("returns 400 when the symbol is missing instead of guessing one", async () => {
    const res = await call("http://x/api/price-series/bitcoin?spot=67000");

    expect(res.status).toBe(400);
    expect(mockSeries).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `cd cryptosense && npx vitest run "app/api/price-series/[id]/route.test.ts"`
Expected: FAIL — `Cannot find module './route'`

- [ ] **Step 3: 寫最小實作**

```typescript
import { NextResponse } from "next/server";
import { getPriceSeries } from "@/lib/tools/priceSeries";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const q = new URL(req.url).searchParams;
  const symbol = q.get("symbol");

  // 缺代號就無法配對交易對。猜一個會讓防呆失效，寧可明確拒絕。
  if (!symbol) {
    return NextResponse.json({ error: "symbol is required" }, { status: 400 });
  }

  const result = await getPriceSeries({
    coinId: id,
    symbol,
    spotPrice: Number(q.get("spot") ?? 0),
    isStablecoin: q.get("stable") === "1",
  });
  return NextResponse.json(result);
}
```

- [ ] **Step 4: 執行測試確認通過**

Run: `cd cryptosense && npx vitest run "app/api/price-series/[id]/route.test.ts"`
Expected: PASS（3 個測試）

- [ ] **Step 5: 提交**

```bash
git add "cryptosense/app/api/price-series/[id]/route.ts" "cryptosense/app/api/price-series/[id]/route.test.ts"
git commit -m "feat(chart): expose the price series endpoint"
```

---

### Task 6: 圖表畫布元件

**Files:**
- Create: `cryptosense/components/PriceChartCanvas.tsx`
- Modify: `cryptosense/package.json`（新增相依）

**Interfaces:**
- Consumes: `SeriesPoint` from `@/lib/tools/priceSeries`
- Produces: `<PriceChartCanvas kind={"candles"|"line"} points={SeriesPoint[]} ma50={{time,value}[]} ma200={{time,value}[]} />`

本元件只負責畫布，不做狀態判斷。**不寫單元測試** —— lightweight-charts 需要
真實 canvas，jsdom 測不出有意義的結果。狀態邏輯全部放在 Task 7 的面板元件，
那一層才是測試重點。

- [ ] **Step 1: 安裝相依**

```bash
cd cryptosense && npm install lightweight-charts
```

- [ ] **Step 2: 建立元件**

```tsx
"use client";
import { useEffect, useRef } from "react";
import { createChart, CandlestickSeries, LineSeries, type IChartApi, type UTCTimestamp } from "lightweight-charts";
import type { SeriesPoint } from "@/lib/tools/priceSeries";

type MaPoint = { time: number; value: number };

export default function PriceChartCanvas({
  kind, points, ma50, ma200,
}: { kind: "candles" | "line"; points: SeriesPoint[]; ma50: MaPoint[]; ma200: MaPoint[] }) {
  const box = useRef<HTMLDivElement>(null);
  const chart = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!box.current) return;
    const c = createChart(box.current, {
      height: 320,
      layout: { background: { color: "transparent" }, textColor: "#6b7280" },
      grid: { vertLines: { visible: false }, horzLines: { color: "#f1f1f0" } },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false },
    });
    chart.current = c;

    // Binance 的日 K 邊界是 UTC，lightweight-charts 的 UTCTimestamp 是「秒」。
    const sec = (ms: number) => (ms / 1000) as UTCTimestamp;

    if (kind === "candles") {
      c.addSeries(CandlestickSeries, {
        upColor: "#05b169", downColor: "#b3541f",
        borderVisible: false, wickUpColor: "#05b169", wickDownColor: "#b3541f",
      }).setData(points.map((p) => ({
        time: sec(p.time), open: p.open!, high: p.high!, low: p.low!, close: p.close,
      })));
    } else {
      c.addSeries(LineSeries, { color: "#2f6f4e", lineWidth: 2 })
        .setData(points.map((p) => ({ time: sec(p.time), value: p.close })));
    }

    if (ma50.length) {
      c.addSeries(LineSeries, { color: "#c08a3e", lineWidth: 1, priceLineVisible: false })
        .setData(ma50.map((m) => ({ time: sec(m.time), value: m.value })));
    }
    if (ma200.length) {
      c.addSeries(LineSeries, { color: "#7b6ea8", lineWidth: 1, priceLineVisible: false })
        .setData(ma200.map((m) => ({ time: sec(m.time), value: m.value })));
    }

    c.timeScale().fitContent();
    const onResize = () => c.applyOptions({ width: box.current?.clientWidth ?? 0 });
    onResize();
    window.addEventListener("resize", onResize);
    return () => { window.removeEventListener("resize", onResize); c.remove(); };
  }, [kind, points, ma50, ma200]);

  return <div ref={box} className="w-full" data-testid="price-chart-canvas" />;
}
```

- [ ] **Step 3: 確認型別與建置**

Run: `cd cryptosense && npx tsc --noEmit`
Expected: 乾淨。若 `addSeries` 簽名不符，先查 `node_modules/lightweight-charts/dist/typings.d.ts`
確認該版本的 API，**不要憑記憶改寫**。

- [ ] **Step 4: 提交**

```bash
git add cryptosense/components/PriceChartCanvas.tsx cryptosense/package.json cryptosense/package-lock.json
git commit -m "feat(chart): add the lightweight-charts canvas component"
```

---

### Task 7: 面板元件與接線

**Files:**
- Create: `cryptosense/components/PriceChartPanel.tsx`
- Test: `cryptosense/components/PriceChartPanel.test.tsx`
- Modify: `cryptosense/components/CoinDetail.tsx:68`
- Delete: `cryptosense/components/PriceTrendChart.tsx`、`cryptosense/components/PriceTrendChart.test.tsx`

**Interfaces:**
- Consumes: `PriceSeries` from `@/lib/tools/priceSeries`、`PriceChartCanvas`（Task 6）
- Produces: `<PriceChartPanel coinId symbol spotPrice isStablecoin />`

- [ ] **Step 1: 寫失敗測試**

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

vi.mock("next/dynamic", () => ({ default: () => () => <div data-testid="price-chart-canvas" /> }));

import { PriceChartPanel } from "./PriceChartPanel";

const props = { coinId: "bitcoin", symbol: "BTC", spotPrice: 67000, isStablecoin: false };

function stubJson(body: unknown) {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(body) }));
}
const points = [{ time: 1, close: 100, open: 99, high: 101, low: 98, volume: 1 }];
const signals = [{ time: 1, rsi14: 28.4, macd: { macd: 1, signal: 0.5, histogram: 0.5 }, ma50: 99, ma200: 98 }];

beforeEach(() => vi.unstubAllGlobals());

describe("PriceChartPanel", () => {
  it("shows the chart and the indicator readouts once data arrives", async () => {
    stubJson({ data: { kind: "candles", source: "Binance", pair: "BTCUSDT", points, signals } });

    render(<PriceChartPanel {...props} />);

    expect(await screen.findByTestId("price-chart-canvas")).toBeInTheDocument();
    expect(screen.getByText(/28\.4/)).toBeInTheDocument();
    expect(screen.getByText(/Binance/)).toBeInTheDocument();
  });

  it("says why a line chart is shown instead of candles", async () => {
    stubJson({ data: { kind: "line", source: "CoinGecko", points: [{ time: 1, close: 100 }], signals } });

    render(<PriceChartPanel {...props} symbol="XMR" />);

    expect(await screen.findByText(/無交易對/)).toBeInTheDocument();
  });

  it("explains that stablecoins are out of scope rather than showing an error", async () => {
    render(<PriceChartPanel {...props} symbol="USDT" isStablecoin />);

    expect(await screen.findByText(/穩定幣/)).toBeInTheDocument();
    expect(screen.queryByText(/暫時無法/)).not.toBeInTheDocument();
  });

  it("distinguishes an outage from a coin that has no data", async () => {
    stubJson({ data: null, code: "unavailable", error: "HTTP 429" });

    render(<PriceChartPanel {...props} />);

    expect(await screen.findByText(/暫時無法/)).toBeInTheDocument();
  });

  it("never labels an indicator with a trading conclusion", async () => {
    stubJson({ data: { kind: "candles", source: "Binance", pair: "BTCUSDT", points, signals } });

    render(<PriceChartPanel {...props} />);
    await screen.findByTestId("price-chart-canvas");

    // RSI 28.4 很想被寫成「超賣」。把指標翻譯成結論在法遵上等同買賣建議。
    expect(screen.queryByText(/超賣|超買|黃金交叉|死亡交叉/)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `cd cryptosense && npx vitest run components/PriceChartPanel.test.tsx`
Expected: FAIL — `Cannot find module './PriceChartPanel'`

- [ ] **Step 3: 寫最小實作**

```tsx
"use client";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import type { PriceSeries } from "@/lib/tools/priceSeries";

// lightweight-charts 需要 DOM，伺服器端渲染會炸。
// next/dynamic 的 ssr:false 在 Server Component 會直接報錯，
// 所以要放在這個 "use client" 元件裡。
const PriceChartCanvas = dynamic(() => import("./PriceChartCanvas"), { ssr: false });

type Props = { coinId: string; symbol: string; spotPrice: number; isStablecoin: boolean };
type State =
  | { s: "loading" }
  | { s: "ready"; series: PriceSeries }
  | { s: "stablecoin" }
  | { s: "nodata" }
  | { s: "outage" };

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-hairline p-4">
      <div className="mb-2 text-sm font-semibold text-ink">{title}</div>
      {children}
    </div>
  );
}

function Readout({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-cb-muted">{label}</div>
      <div className="font-mono text-[13px] text-ink">{value}</div>
    </div>
  );
}

export function PriceChartPanel({ coinId, symbol, spotPrice, isStablecoin }: Props) {
  const [st, setSt] = useState<State>(isStablecoin ? { s: "stablecoin" } : { s: "loading" });

  useEffect(() => {
    if (isStablecoin) return;
    let alive = true;
    const url = `/api/price-series/${coinId}?symbol=${encodeURIComponent(symbol)}` +
      `&spot=${spotPrice}&stable=0`;
    fetch(url)
      .then((r) => r.json())
      .then((j) => {
        if (!alive) return;
        if (j?.data) setSt({ s: "ready", series: j.data });
        // 「這個幣沒有資料」和「服務掛了」必須分開。混在一起的話，
        // 功能壞掉會偽裝成「本來就沒有」，沒有人會發現。
        else setSt({ s: j?.code === "unavailable" ? "outage" : "nodata" });
      })
      .catch(() => alive && setSt({ s: "outage" }));
    return () => { alive = false; };
  }, [coinId, symbol, spotPrice, isStablecoin]);

  if (st.s === "stablecoin") {
    return <Shell title={`${symbol} 走勢`}>
      <p className="text-sm text-cb-muted">穩定幣價格設計上固定，技術指標不適用。</p>
    </Shell>;
  }
  if (st.s === "outage") {
    return <Shell title={`${symbol} 走勢`}>
      <p className="text-sm text-cb-muted">行情資料暫時無法取得，請稍後再試。</p>
    </Shell>;
  }
  if (st.s === "nodata") {
    return <Shell title={`${symbol} 走勢`}>
      <p className="text-sm text-cb-muted">此幣目前沒有可用的歷史價格資料。</p>
    </Shell>;
  }
  if (st.s === "loading") {
    return <Shell title={`${symbol} 走勢`}>
      <div className="h-80 animate-pulse rounded-xl bg-soft" />
    </Shell>;
  }

  const { series } = st;
  const last = series.signals.at(-1);
  const ma = (k: "ma50" | "ma200") =>
    series.signals.flatMap((s) => (s[k] === undefined ? [] : [{ time: s.time, value: s[k]! }]));

  return (
    <Shell title={`${symbol} 90 日走勢`}>
      <div className="mb-2 text-[11px] text-cb-muted">
        來源：{series.source}
        {series.kind === "candles" ? ` · ${series.pair} · 日 K（UTC）` : " · 每日收盤價"}
        {series.kind === "line" && `　此幣在 Binance 無交易對，改用每日收盤價，因此沒有 K 線`}
      </div>
      <PriceChartCanvas kind={series.kind} points={series.points} ma50={ma("ma50")} ma200={ma("ma200")} />
      <div className="mt-3 grid grid-cols-2 gap-3 border-t border-hairline-soft pt-3 sm:grid-cols-4">
        <Readout label="RSI 14" value={last?.rsi14?.toFixed(1) ?? "—"} />
        <Readout label="MACD" value={last?.macd ? `${last.macd.macd.toFixed(2)} / ${last.macd.signal.toFixed(2)}` : "—"} />
        <Readout label="MA50" value={last?.ma50?.toFixed(2) ?? "—"} />
        <Readout label="MA200" value={last?.ma200?.toFixed(2) ?? "—"} />
      </div>
    </Shell>
  );
}
```

- [ ] **Step 4: 執行測試確認通過**

Run: `cd cryptosense && npx vitest run components/PriceChartPanel.test.tsx`
Expected: PASS（5 個測試）

- [ ] **Step 5: 接到幣種頁面**

在 `components/CoinDetail.tsx`：
1. 第 6 行 `import { PriceTrendChart } from "./PriceTrendChart";`
   改為 `import { PriceChartPanel } from "./PriceChartPanel";`
2. 第 68 行 `<PriceTrendChart symbol={coin.symbol} data={coin.spark7d} change7d={coin.change7d} />`
   改為：

```tsx
      <PriceChartPanel
        coinId={coin.id}
        symbol={coin.symbol}
        spotPrice={coin.price}
        isStablecoin={coin.isStablecoin}
      />
```

- [ ] **Step 6: 移除被取代的元件**

`PriceTrendChart` 在取代後就沒有任何使用者。Dashboard 用的是另一個元件
（`MarketDashboard.tsx` 內的 `Sparkline`），**不受影響、不要動**。

```bash
cd cryptosense && rm components/PriceTrendChart.tsx components/PriceTrendChart.test.tsx
```

若 `components/CoinDetail.test.tsx` 有斷言 7 天走勢圖的標題文字，改為斷言新面板。

- [ ] **Step 7: 完整驗證**

```bash
cd cryptosense && npm test && npx tsc --noEmit && npm run build
```
Expected: 測試全綠、型別乾淨、建置成功

- [ ] **Step 8: 提交**

```bash
git add cryptosense/components cryptosense/lib
git commit -m "feat(chart): replace the 7-day sparkline with the 90-day chart panel"
```

---

### Task 8: 部署限制記錄

**Files:**
- Modify: `cryptosense/README.md`（若無則建立）

Binance 對美國 IP 回 **451**。服務部署在美國區的話，**一半的幣會從 K 線
悄悄退化成折線** —— 因為第二層會接手，畫面上不會有任何錯誤訊息。
功能看起來正常，只是變差了。這是最難發現的失敗模式，必須寫下來。

- [ ] **Step 1: 加入部署章節**

```markdown
## 部署限制

**服務必須部署在非美國區域（指定新加坡）。**

K 線資料來自 Binance，Binance 對美國 IP 回傳 451。部署在美國區的後果不是
功能報錯，而是**約一半的幣悄悄從 K 線退化成折線圖**，因為 CoinGecko 折線層
會自動接手。畫面上不會出現任何錯誤訊息。

檢查方式：開啟一個確定有 Binance 交易對的幣（例如 BTC、ETH），
資料來源標籤應顯示「Binance」。若顯示「CoinGecko」，代表部署區域錯誤。
```

- [ ] **Step 2: 提交**

```bash
git add cryptosense/README.md
git commit -m "docs: record the non-US deployment requirement for Binance"
```

---

## Self-Review

**Spec coverage：**

| 規格章節 | 對應任務 |
|---|---|
| 4.1 兩層資料來源 | Task 1、2、4 |
| 4.1 穩定幣不適用 | Task 3、4、7 |
| 4.2 幣種對應與驗價防呆 | Task 1、4 |
| 4.3 250 抓／90 顯示、丟未收盤 | Task 2、4（Binance 側已完成） |
| 4.4 快取時間 | Task 1（24h）、Task 2（6h）、已完成（日 K 6h 需確認） |
| 5 畫面四種狀態 | Task 7 |
| 5 指標只給數字 | Task 7 Step 1 最後一個測試 |
| 5 載入骨架 | Task 7 |
| 6 測試計畫 | Task 1、2、3、4、5、7 |
| 8 部署限制 | Task 8 |

**自我檢查時找到並已修正：** `lib/tools/ohlcv.ts` 的日 K 快取原本是 5 分鐘，
與規格的 6 小時不符。已改為 `6 * 60 * 60 * 1000`，既有 8 個測試重跑通過。

**降級階梯**（規格 4.4）本輪不實作，屬於上線後依觀測調整的操作程序，
已記在規格文件中。

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-08-15-cryptosense-price-chart.md`.
