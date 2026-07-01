# CryptoSense — 聚合器導向 UI/UX 調整 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 CryptoSense 的市場總覽、頂列導覽、個幣分析頁改成貼近 CoinMarketCap/CoinGecko 使用者心智模型的呈現方式（全站搜尋、多時間窗漲跌、排名變動箭頭、真實幣種 logo、個幣頁統計格與趨勢圖），同時修正一個施工中發現的落差：現有 `MarketDashboard.tsx`/`CoinDetail.tsx`/`format.ts`/`Sparkline.tsx` 其實從未真的套用 `DESIGN-v2-research-driven.md` 的白底 tokens（只有 `Chat.tsx`/`CitationPanel.tsx` 套用了），本次一併補齊。

**Architecture:** 資料層（`lib/tools/market.ts`、`lib/tools/coin.ts`）擴充既有 CoinGecko 呼叫的回傳欄位（`image`/`marketCapRank`/多時間窗漲跌），不新增快取策略；新增一支唯讀查詢 `lib/tools/search.ts`（CoinGecko `/search`，供頂列全站搜尋用，不計入 AI 問答「剛好 3 支工具」）。UI 層新增兩個共用元件（`CoinIcon`、`PriceTrendChart`）與一個新的 `TopBar`，並重寫 `MarketDashboard`/`CoinDetail` 套用 v2 白底 tokens + 新版面。全程沿用既有 `ToolResult<T>` 慣例、記憶體快取、TDD 流程。

**Tech Stack:** Next.js 16（App Router）· TypeScript · Tailwind v4（`app/globals.css` 既有 v2 tokens：`bg-canvas`/`text-ink`/`text-body`/`text-cb-muted`/`border-hairline`/`text-up`/`text-down`/`text-down-soft`/`text-cb-primary`）· Vitest + @testing-library/react · recharts（既有 `Sparkline`，新增 `PriceTrendChart`）。

## Global Constraints

- 範圍：`cryptosense/`，延續 `feat/cryptosense-p1` 分支。**不新增 DB，不新增 AI 工具（維持剛好 3 支：getCoinData/getCryptoNews/searchKnowledgeBase）。**
- 新增的 `searchCoins` 是一般唯讀資料查詢（供頂列 UI 搜尋用），不透過 AI `tool()` 包裝，不影響 AI 問答工具數量的既有約束。
- 資料工具回傳型別一律 `ToolResult<T> = { data: T | null; source: string; timestamp: string; error?: string }`；錯誤回 `fail`，不編造數字。對外資料模組頂部 `import "server-only"`。
- 排名變動箭頭（`rankChange`）只能用「本次請求 vs. 上一次成功請求」的記憶體內比較（模組層級 `Map`，隨伺服器行程存活，重啟即重置）；**不得引入 DB 或任何持久化**，這是與 CMC 真正「24h 前排名」比較的已知差異，須在程式碼註解中誠實標註。
- 個幣頁趨勢圖只做 7D（沿用既有 `sparkline` 資料），不呼叫 `market_chart` API，不做 1D/1M/1Y 時間窗切換，不做技術指標/K 線（P2 範圍）。
- 色彩規則沿用 `DESIGN-v2-research-driven.md`：漲用 `text-up`（#05b169），跌預設用 `text-down-soft`（#b3541f，磚橘），品牌識別色只透過幣種 logo 本身呈現，不额外用顏色標記代號文字或排名數字（次要文字統一 `text-cb-muted`/`text-body`）。
- TDD：每個 task 先寫失敗測試，跑 `npm run typecheck` + `npm test`，UI 大改動的 task 最後跑 `npm run build`。
- 對齊 `docs/superpowers/specs/2026-07-02-cryptosense-aggregator-ui-refresh-design.md`。

## File Structure

```
cryptosense/
├── lib/
│   ├── tools/
│   │   ├── market.ts          # 改：MarketCoin 加 image/marketCapRank/change1h/change7d/rankChange
│   │   ├── market.test.ts     # 改
│   │   ├── coin.ts            # 改：CoinData 加 image/marketCapRank/change7d/spark7d
│   │   ├── coin.test.ts       # 改
│   │   ├── search.ts          # 新：searchCoins（CoinGecko /search，唯讀，非 AI 工具）
│   │   └── search.test.ts     # 新
│   └── format.ts              # 改：changeClass 遷移到 v2 tokens；新增 numCompact
├── components/
│   ├── CoinIcon.tsx           # 新：真實幣種 logo + 失敗時退回代號首字母
│   ├── CoinIcon.test.tsx      # 新
│   ├── PriceTrendChart.tsx    # 新：個幣頁放大版 7 日趨勢圖（主動陳述標題）
│   ├── PriceTrendChart.test.tsx # 新
│   ├── TopBar.tsx             # 新：wordmark + 分頁連結 + 全站搜尋
│   ├── TopBar.test.tsx        # 新
│   ├── Sparkline.tsx          # 改：顏色改用 v2 up/down-soft 色值
│   ├── MarketDashboard.tsx    # 改：v2 tokens + 搜尋 + 排名箭頭 + 1H/24H/7D + 真實 logo
│   ├── MarketDashboard.test.tsx # 改
│   ├── CoinDetail.tsx         # 改：v2 tokens + 4 格統計 + 趨勢圖 + 真實 logo + CTA 改樣式
│   └── CoinDetail.test.tsx    # 改
└── app/
    ├── layout.tsx              # 改：加 <TopBar />
    ├── page.tsx                 # 改：移除舊深色標題，改 breadcrumb 樣式
    ├── coin/[id]/page.tsx       # 改：breadcrumb + #ai-chat 錨點目標
    └── api/
        └── search/route.ts     # 新：GET ?q= → searchCoins
        └── search/route.test.ts # 新
```

---

### Task 1: 市場總覽資料層擴充（image / marketCapRank / 1H·24H·7D / 排名變動）

**Files:**
- Modify: `cryptosense/lib/tools/market.ts`, `cryptosense/lib/tools/market.test.ts`

**Interfaces:**
- Consumes: `ok`, `fail`, `cachedFetch`（`lib/tools/http.ts`，簽名不變）。
- Produces：
  - `type MarketCoin = { id: string; symbol: string; name: string; image: string; marketCapRank: number; price: number; change1h: number; change24h: number; change7d: number; marketCap: number; spark7d: number[]; rankChange: "up" | "down" | "same" | null }`
  - `function getMarketOverview(): Promise<ToolResult<MarketOverview>>`（簽名不變，回傳的 `coins` 型別擴充如上）
  - `function __clearRankHistory(): void`（測試用，清除模組層級的排名歷史 Map）

- [ ] **Step 1: 寫失敗測試**

`cryptosense/lib/tools/market.test.ts`（整檔取代）：
```ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { getMarketOverview, getFearGreedIndex } from "./market";
import { __clearCache } from "./http";
import { __clearRankHistory } from "./market";

beforeEach(() => {
  __clearCache();
  __clearRankHistory();
});

function stubMarkets(coins: any[], global: any) {
  vi.stubGlobal(
    "fetch",
    vi.fn((u: string) =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(String(u).includes("/global") ? global : coins),
      }),
    ),
  );
}

const globalFixture = {
  data: { total_market_cap: { usd: 3.42e12 }, total_volume: { usd: 9.8e10 }, market_cap_percentage: { btc: 54.3 } },
};

describe("getMarketOverview", () => {
  it("maps markets + global, including image/rank/1h/7d", async () => {
    stubMarkets(
      [
        {
          id: "bitcoin", symbol: "btc", name: "Bitcoin",
          image: "https://assets.coingecko.com/coins/images/1/small/bitcoin.png",
          market_cap_rank: 1, current_price: 67200, market_cap: 1.3e12,
          price_change_percentage_24h: 1.2,
          price_change_percentage_1h_in_currency: 0.3,
          price_change_percentage_24h_in_currency: 1.2,
          price_change_percentage_7d_in_currency: 5.0,
          sparkline_in_7d: { price: [1, 2, 3] },
        },
      ],
      globalFixture,
    );
    const r = await getMarketOverview();
    expect(r.source).toBe("CoinGecko");
    expect(r.data!.btcDominance).toBe(54.3);
    expect(r.data!.coins[0]).toMatchObject({
      id: "bitcoin", symbol: "BTC", price: 67200,
      image: "https://assets.coingecko.com/coins/images/1/small/bitcoin.png",
      marketCapRank: 1, change1h: 0.3, change24h: 1.2, change7d: 5.0, spark7d: [1, 2, 3],
    });
    // 呼叫的是同一支 markets API，只是參數多帶 1h,24h,7d
    const marketsCall = (globalThis.fetch as any).mock.calls.find((c: any[]) => !String(c[0]).includes("/global"));
    expect(marketsCall[0]).toContain("price_change_percentage=1h,24h,7d");
  });

  it("returns null rankChange on first sighting, then a direction once rank moves", async () => {
    const coinAt = (rank: number) => [{
      id: "solana", symbol: "sol", name: "Solana", image: "img", market_cap_rank: rank,
      current_price: 172.4, market_cap: 8e10, price_change_percentage_24h: 6.2,
      price_change_percentage_1h_in_currency: 1, price_change_percentage_24h_in_currency: 6.2,
      price_change_percentage_7d_in_currency: 9.8, sparkline_in_7d: { price: [1, 2] },
    }];
    stubMarkets(coinAt(5), globalFixture);
    const first = await getMarketOverview();
    expect(first.data!.coins[0].rankChange).toBeNull();

    __clearCache(); // force a real refetch instead of the 90s in-memory cache hit
    stubMarkets(coinAt(3), globalFixture);
    const second = await getMarketOverview();
    expect(second.data!.coins[0].rankChange).toBe("up"); // rank 5 -> 3 is an improvement
  });

  it("returns error on failure (no stale)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 429 }));
    const r = await getMarketOverview();
    expect(r.data).toBeNull();
    expect(r.error).toContain("429");
  });
});

describe("getFearGreedIndex", () => {
  it("parses string value to number", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true,
      json: () => Promise.resolve({ data: [{ value: "52", value_classification: "Neutral" }] }) }));
    const r = await getFearGreedIndex();
    expect(r.data).toEqual({ value: 52, label: "Neutral" });
  });
});
```

- [ ] **Step 2: 跑測試確認失敗** — Run: `npm test -- market` → FAIL（新欄位不存在、`__clearRankHistory` 未匯出）。

- [ ] **Step 3: 實作**

`cryptosense/lib/tools/market.ts`（整檔取代）：
```ts
import "server-only";
import { ok, fail, cachedFetch } from "./http";
import type { ToolResult } from "./types";

export type MarketCoin = {
  id: string; symbol: string; name: string; image: string; marketCapRank: number;
  price: number; change1h: number; change24h: number; change7d: number;
  marketCap: number; spark7d: number[]; rankChange: "up" | "down" | "same" | null;
};
export type MarketOverview = { totalMarketCap: number; totalVolume: number; btcDominance: number; coins: MarketCoin[] };
export type FearGreed = { value: number; label: string };

const CG = "https://api.coingecko.com/api/v3";
const cgHeaders = () => (process.env.COINGECKO_DEMO_KEY ? { "x-cg-demo-api-key": process.env.COINGECKO_DEMO_KEY } : undefined);

/**
 * 排名變動：只跟「上一次成功抓到的資料」比較（記憶體內、隨伺服器行程存活）。
 * 這不是真正的「24 小時前排名」（CMC 用自家歷史快照算），P1.x 無 DB，
 * 這是唯一不需要持久化就能做到的近似版本；伺服器重啟或快取過期前的
 * 第一次呼叫一律回傳 null（沒有基準可比較）。
 */
const lastRanks = new Map<string, number>();
export function __clearRankHistory() { lastRanks.clear(); }
function rankChangeFor(id: string, rank: number): "up" | "down" | "same" | null {
  const prev = lastRanks.get(id);
  lastRanks.set(id, rank);
  if (prev === undefined) return null;
  if (rank < prev) return "up";
  if (rank > prev) return "down";
  return "same";
}

export async function getMarketOverview(): Promise<ToolResult<MarketOverview>> {
  try {
    const [markets, global] = await Promise.all([
      cachedFetch(`${CG}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=25&page=1&sparkline=true&price_change_percentage=1h,24h,7d`, { ttlMs: 90_000, headers: cgHeaders() }),
      cachedFetch(`${CG}/global`, { ttlMs: 300_000, headers: cgHeaders() }),
    ]);
    const coins: MarketCoin[] = markets.map((m: any) => {
      const marketCapRank = m.market_cap_rank ?? 0;
      return {
        id: m.id, symbol: String(m.symbol).toUpperCase(), name: m.name,
        image: m.image ?? "", marketCapRank,
        price: m.current_price, change24h: m.price_change_percentage_24h ?? 0,
        change1h: m.price_change_percentage_1h_in_currency ?? 0,
        change7d: m.price_change_percentage_7d_in_currency ?? 0,
        marketCap: m.market_cap, spark7d: m.sparkline_in_7d?.price ?? [],
        rankChange: rankChangeFor(m.id, marketCapRank),
      };
    });
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
```

- [ ] **Step 4: 跑測試確認通過** — Run: `npm test -- market` → PASS。`npm run typecheck` 乾淨。

- [ ] **Step 5: Commit**
```bash
git add cryptosense/lib/tools/market.ts cryptosense/lib/tools/market.test.ts
git commit -m "feat(market): add coin image/rank/1h·7d change + in-memory rank-delta"
```

---

### Task 2: 個幣資料層擴充（image / marketCapRank / change7d / spark7d）

**Files:**
- Modify: `cryptosense/lib/tools/coin.ts`, `cryptosense/lib/tools/coin.test.ts`

**Interfaces:**
- Produces：
  - `type CoinData = { id: string; symbol: string; name: string; image: string; marketCapRank: number; price: number; change24h: number; change7d: number; marketCap: number; volume24h: number; circulatingSupply: number; spark7d: number[] }`
  - `function getCoinData(id: string): Promise<ToolResult<CoinData>>`（簽名不變）

- [ ] **Step 1: 寫失敗測試**

`cryptosense/lib/tools/coin.test.ts`（整檔取代）：
```ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { getCoinData } from "./coin";
import { __clearCache } from "./http";

beforeEach(() => __clearCache());

describe("getCoinData", () => {
  it("maps coin detail including image/rank/7d change/sparkline", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({
      id: "ethereum", symbol: "eth", name: "Ethereum",
      image: { thumb: "https://x/eth-thumb.png", small: "https://x/eth-small.png", large: "https://x/eth-large.png" },
      market_cap_rank: 2,
      market_data: {
        current_price: { usd: 3540 }, price_change_percentage_24h: -0.82, price_change_percentage_7d: 2.1,
        market_cap: { usd: 4.25e11 }, total_volume: { usd: 1.8e10 }, circulating_supply: 1.2e8,
        sparkline_7d: { price: [10, 9.8, 9.9, 10.1] },
      } }) }));
    const r = await getCoinData("ethereum");
    expect(r.data).toMatchObject({
      id: "ethereum", symbol: "ETH", name: "Ethereum",
      image: "https://x/eth-small.png", marketCapRank: 2,
      price: 3540, change24h: -0.82, change7d: 2.1,
      marketCap: 4.25e11, volume24h: 1.8e10, circulatingSupply: 1.2e8,
      spark7d: [10, 9.8, 9.9, 10.1],
    });
  });
  it("returns error on failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 404 }));
    const r = await getCoinData("nope");
    expect(r.data).toBeNull();
    expect(r.error).toContain("404");
  });
});
```

- [ ] **Step 2: 跑測試確認失敗** — Run: `npm test -- coin` → FAIL。

- [ ] **Step 3: 實作**

`cryptosense/lib/tools/coin.ts`（整檔取代）：
```ts
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
```

- [ ] **Step 4: 跑測試確認通過** — Run: `npm test -- coin` → PASS。`npm run typecheck` 乾淨。

- [ ] **Step 5: Commit**
```bash
git add cryptosense/lib/tools/coin.ts cryptosense/lib/tools/coin.test.ts
git commit -m "feat(coin): add image/rank/7d change/sparkline to CoinData"
```

---

### Task 3: 格式化與圖表色彩遷移到 v2 tokens

**Files:**
- Modify: `cryptosense/lib/format.ts`, `cryptosense/components/Sparkline.tsx`

**Interfaces:**
- Produces：`changeClass(n: number): string`（回傳 `"text-up"` 或 `"text-down-soft"`，取代舊的 `text-green-500`/`text-red-500`）；新增 `numCompact(n: number): string`（純數字千分位精簡格式，不帶貨幣符號，供流通量等非金額數字使用）。

- [ ] **Step 1: 實作（無獨立測試檔；由 Task 8/9 的元件測試間接驗證顏色 class）**

`cryptosense/lib/format.ts`（整檔取代）：
```ts
export const pct = (n: number) => `${n >= 0 ? "▲" : "▼"} ${Math.abs(n).toFixed(2)}%`;
export const usdCompact = (n: number) =>
  new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 2, style: "currency", currency: "USD" }).format(n);
export const numCompact = (n: number) =>
  new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 2 }).format(n);
export const changeClass = (n: number) => (n >= 0 ? "text-up" : "text-down-soft");
```

`cryptosense/components/Sparkline.tsx`（整檔取代——顏色改用 v2 `--up`/`--down-soft` 色值，元件邏輯不變）：
```tsx
"use client";
import { LineChart, Line, ResponsiveContainer } from "recharts";

export function Sparkline({ data, up }: { data: number[]; up: boolean }) {
  return (
    <ResponsiveContainer width="100%" height={32}>
      <LineChart data={data.map((v) => ({ v }))}>
        <Line type="monotone" dataKey="v" stroke={up ? "#05b169" : "#b3541f"} dot={false} strokeWidth={1.5} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
```

- [ ] **Step 2: Typecheck** — Run: `cd cryptosense && npm run typecheck` → 乾淨（`format.ts`/`Sparkline.tsx` 目前的消費者 `MarketDashboard.tsx`/`CoinDetail.tsx` 會在 Task 8/9 更新引用，此時它們還在用舊 class 字串比對測試，Task 3 commit 後、Task 8/9 之前跑 `npm test` 預期 `MarketDashboard.test.tsx`/`CoinDetail.test.tsx` 會短暫 FAIL——這是預期中的暫時失敗，Task 8/9 會修正，不需要在本 task 處理。

- [ ] **Step 3: Commit**
```bash
git add cryptosense/lib/format.ts cryptosense/components/Sparkline.tsx
git commit -m "feat(design): migrate changeClass/Sparkline colors to v2 up/down-soft tokens"
```

---

### Task 4: CoinIcon 共用元件（真實幣種 logo + 失敗退回代號首字母）

**Files:**
- Create: `cryptosense/components/CoinIcon.tsx`, `cryptosense/components/CoinIcon.test.tsx`

**Interfaces:**
- Produces：`CoinIcon({ image, symbol, size }: { image?: string; symbol: string; size?: number }): JSX.Element`（`size` 預設 22px；無 `image` 或圖片載入失敗時顯示代號首字母的圓形色塊）。

- [ ] **Step 1: 寫失敗測試**

`cryptosense/components/CoinIcon.test.tsx`：
```tsx
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CoinIcon } from "./CoinIcon";

describe("CoinIcon", () => {
  it("renders an image when a logo url is given", () => {
    render(<CoinIcon image="https://x/eth.png" symbol="ETH" />);
    expect(screen.getByRole("img", { name: "ETH" })).toHaveAttribute("src", "https://x/eth.png");
  });
  it("falls back to a monogram when no image is given", () => {
    render(<CoinIcon symbol="ETH" />);
    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.getByText("E")).toBeInTheDocument();
  });
  it("falls back to a monogram when the image fails to load", () => {
    render(<CoinIcon image="https://x/broken.png" symbol="SOL" />);
    fireEvent.error(screen.getByRole("img", { name: "SOL" }));
    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.getByText("S")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 跑測試確認失敗** — Run: `npm test -- CoinIcon` → FAIL（檔案不存在）。

- [ ] **Step 3: 實作**

`cryptosense/components/CoinIcon.tsx`：
```tsx
"use client";
import { useState } from "react";

export function CoinIcon({ image, symbol, size = 22 }: { image?: string; symbol: string; size?: number }) {
  const [broken, setBroken] = useState(false);
  if (!image || broken) {
    return (
      <span
        style={{ width: size, height: size, fontSize: size * 0.45 }}
        className="inline-flex shrink-0 items-center justify-center rounded-full bg-soft font-semibold text-cb-muted"
      >
        {symbol.slice(0, 1)}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={image}
      alt={symbol}
      width={size}
      height={size}
      className="shrink-0 rounded-full"
      onError={() => setBroken(true)}
    />
  );
}
```

- [ ] **Step 4: 跑測試確認通過** — Run: `npm test -- CoinIcon` → PASS。

- [ ] **Step 5: Commit**
```bash
git add cryptosense/components/CoinIcon.tsx cryptosense/components/CoinIcon.test.tsx
git commit -m "feat(ui): CoinIcon — real coin logo with monogram fallback"
```

---

### Task 5: 全站搜尋唯讀查詢（`searchCoins` + `/api/search`）

**Files:**
- Create: `cryptosense/lib/tools/search.ts`, `cryptosense/lib/tools/search.test.ts`, `cryptosense/app/api/search/route.ts`, `cryptosense/app/api/search/route.test.ts`

**Interfaces:**
- Consumes: `ok`, `fail`, `cachedFetch`。
- Produces：
  - `type CoinSearchResult = { id: string; symbol: string; name: string; image: string }`
  - `function searchCoins(query: string): Promise<ToolResult<CoinSearchResult[]>>`（**非 AI 工具**，一般唯讀資料查詢；空字串直接回空陣列、不打 API）
  - `GET /api/search?q=...` → `ToolResult<CoinSearchResult[]>` JSON

- [ ] **Step 1: 寫失敗測試**

`cryptosense/lib/tools/search.test.ts`：
```ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { searchCoins } from "./search";
import { __clearCache } from "./http";

beforeEach(() => __clearCache());
afterEach(() => vi.unstubAllGlobals());

describe("searchCoins", () => {
  it("maps CoinGecko /search results (prefers thumb, falls back to large)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({
      coins: [{ id: "ethereum", symbol: "eth", name: "Ethereum", thumb: "https://x/eth-thumb.png", large: "https://x/eth-large.png" }],
    }) }));
    const r = await searchCoins("eth");
    expect(r.source).toBe("CoinGecko");
    expect(r.data![0]).toEqual({ id: "ethereum", symbol: "ETH", name: "Ethereum", image: "https://x/eth-thumb.png" });
  });
  it("returns an empty list without calling the API for a blank query", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const r = await searchCoins("   ");
    expect(r.data).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("returns fail (no fabrication) when the API errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 429 }));
    const r = await searchCoins("eth");
    expect(r.data).toBeNull();
    expect(r.error).toContain("429");
  });
});
```

- [ ] **Step 2: 跑測試確認失敗** — Run: `npm test -- "tools/search"` → FAIL。

- [ ] **Step 3: 實作 `searchCoins`**

`cryptosense/lib/tools/search.ts`：
```ts
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
```

- [ ] **Step 4: 跑測試確認通過** — Run: `npm test -- "tools/search"` → PASS。

- [ ] **Step 5: 寫失敗測試（route）**

`cryptosense/app/api/search/route.test.ts`：
```ts
// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/tools/search", () => ({ searchCoins: vi.fn() }));

import { GET } from "./route";
import { searchCoins } from "@/lib/tools/search";

describe("GET /api/search", () => {
  it("passes the q query param through to searchCoins", async () => {
    vi.mocked(searchCoins).mockResolvedValue({ data: [], source: "CoinGecko", timestamp: "t" });
    const res = await GET(new NextRequest("http://x/api/search?q=eth"));
    expect(searchCoins).toHaveBeenCalledWith("eth");
    const body = await res.json();
    expect(body.data).toEqual([]);
  });
  it("defaults to an empty query string when q is missing", async () => {
    vi.mocked(searchCoins).mockResolvedValue({ data: [], source: "CoinGecko", timestamp: "t" });
    await GET(new NextRequest("http://x/api/search"));
    expect(searchCoins).toHaveBeenCalledWith("");
  });
});
```
> 用 `NextRequest`（非純 `Request`）建構請求物件，因為 route 的 `GET` 簽名改用 `NextRequest` 以讀取 `request.nextUrl.searchParams`（依 Next.js 16 Route Handler 官方文件慣例，而非手動 `new URL(req.url)`）。

- [ ] **Step 6: 跑測試確認失敗** — Run: `npm test -- "api/search"` → FAIL。

- [ ] **Step 7: 實作 route**

`cryptosense/app/api/search/route.ts`：
```ts
import { type NextRequest, NextResponse } from "next/server";
import { searchCoins } from "@/lib/tools/search";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q") ?? "";
  const result = await searchCoins(q);
  return NextResponse.json(result);
}
```

- [ ] **Step 8: 跑測試確認通過** — Run: `npm test -- "api/search"` → PASS。`npm run typecheck` 乾淨。

- [ ] **Step 9: Commit**
```bash
git add cryptosense/lib/tools/search.ts cryptosense/lib/tools/search.test.ts cryptosense/app/api/search/route.ts cryptosense/app/api/search/route.test.ts
git commit -m "feat(search): read-only coin search (CoinGecko /search) for top-bar lookup"
```

---

### Task 6: TopBar（wordmark + 分頁連結 + 全站搜尋）

**Files:**
- Create: `cryptosense/components/TopBar.tsx`, `cryptosense/components/TopBar.test.tsx`
- Modify: `cryptosense/app/layout.tsx`

**Interfaces:**
- Consumes: `GET /api/search?q=`；`next/navigation` 的 `useRouter`；`CoinIcon`。
- Produces：`TopBar(): JSX.Element`（client component，無 props）。

- [ ] **Step 1: 寫失敗測試**

`cryptosense/components/TopBar.test.tsx`：
```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const push = vi.fn();
// Mock every export the App Router might reach for, not just useRouter — an
// un-mocked next/navigation export throws "X is not a function" if anything
// in the tree touches it, even indirectly.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn(), back: vi.fn(), forward: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

import { TopBar } from "./TopBar";

beforeEach(() => push.mockClear());
afterEach(() => vi.unstubAllGlobals());

describe("TopBar", () => {
  it("shows the wordmark and nav, with no account/sign-in chrome", () => {
    render(<TopBar />);
    expect(screen.getByRole("link", { name: /CryptoSense/ })).toBeInTheDocument();
    expect(screen.queryByText(/登入|註冊|Sign/)).toBeNull();
  });

  it("shows search results after typing and navigates to the coin page on click", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [{ id: "ethereum", symbol: "ETH", name: "Ethereum", image: "" }] }),
    }));
    render(<TopBar />);
    fireEvent.change(screen.getByPlaceholderText("搜尋幣種或代號..."), { target: { value: "eth" } });
    const option = await screen.findByRole("option", { name: /Ethereum/ }, { timeout: 1000 });
    fireEvent.click(option);
    expect(push).toHaveBeenCalledWith("/coin/ethereum");
  });
});
```

- [ ] **Step 2: 跑測試確認失敗** — Run: `npm test -- TopBar` → FAIL（檔案不存在）。

- [ ] **Step 3: 實作**

`cryptosense/components/TopBar.tsx`：
```tsx
"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CoinIcon } from "./CoinIcon";
import type { CoinSearchResult } from "@/lib/tools/search";

const DEBOUNCE_MS = 250;

export function TopBar() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CoinSearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const q = query.trim();
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!q) {
      setResults([]);
      setOpen(false);
      return;
    }
    debounceRef.current = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(q)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          setResults(Array.isArray(data?.data) ? data.data : []);
          setOpen(true);
        })
        .catch(() => {
          setResults([]);
          setOpen(false);
        });
    }, DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  const go = (id: string) => {
    setOpen(false);
    setQuery("");
    router.push(`/coin/${id}`);
  };

  return (
    <header className="flex h-14 items-center justify-between gap-4 border-b border-hairline bg-canvas px-5">
      <Link href="/" className="shrink-0 text-[15px] font-bold text-ink">
        Crypto<span className="text-cb-primary">Sense</span>
      </Link>
      <nav className="hidden gap-5 text-[13px] text-body sm:flex">
        <Link href="/">市場</Link>
        <Link href="/">幣種</Link>
        <Link href="/">知識庫</Link>
      </nav>
      <div className="relative w-56">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          onBlur={() => setOpen(false)}
          placeholder="搜尋幣種或代號..."
          aria-label="搜尋幣種或代號"
          role="combobox"
          aria-expanded={open}
          aria-controls="topbar-search-listbox"
          aria-autocomplete="list"
          className="w-full rounded-md border border-hairline px-3 py-1.5 text-[12px] text-ink placeholder:text-cb-muted"
        />
        {open && results.length > 0 && (
          <ul
            id="topbar-search-listbox"
            role="listbox"
            // Prevent the input from ever blurring when a result is clicked —
            // preventing mousedown's default action stops the browser's
            // implicit focus shift, so there's no race against onBlur to win.
            onMouseDown={(e) => e.preventDefault()}
            className="absolute right-0 top-full z-10 mt-1 w-64 rounded-md border border-hairline bg-canvas py-1 shadow-lg"
          >
            {results.map((c) => (
              <li key={c.id} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected="false"
                  onClick={() => go(c.id)}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] text-ink hover:bg-soft"
                >
                  <CoinIcon image={c.image} symbol={c.symbol} size={18} />
                  <span>{c.name}</span>
                  <span className="text-cb-muted">{c.symbol}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </header>
  );
}
```
> `<ul>` 上的 `onMouseDown={(e) => e.preventDefault()}` 取代原本「`onMouseDown` 選項 + 150ms 延遲 `onBlur`」的計時器賽跑寫法——阻止 mousedown 的預設行為會讓 input 完全不會失焦，因此點擊可以直接用一般的 `onClick`，`onBlur` 也不需要延遲（依 WAI-ARIA combobox pattern 慣例；`role="combobox"`/`aria-expanded`/`aria-controls`/`role="listbox"`/`role="option"` 是同一份規範建議的最低限度 ARIA 標記，不含完整鍵盤導覽/`aria-activedescendant`，這部分留待未來如有無障礙需求再擴充）。

- [ ] **Step 4: 接入 layout**

`cryptosense/app/layout.tsx`（整檔取代）：
```tsx
import type { Metadata } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import { TopBar } from "@/components/TopBar";
import "./globals.css";

const sans = Inter({ subsets: ["latin"], variable: "--font-sans" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "CryptoSense · 加密貨幣風險研究助手",
  description: "進場前的風險與盲點提醒：整合即時行情、新聞情緒與個人知識庫的 AI 研究助手。非投資建議。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-Hant"
      className={`${sans.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <TopBar />
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 5: 跑測試確認通過** — Run: `npm test -- TopBar` → PASS。`npm run typecheck` 乾淨。

- [ ] **Step 6: Commit**
```bash
git add cryptosense/components/TopBar.tsx cryptosense/components/TopBar.test.tsx cryptosense/app/layout.tsx
git commit -m "feat(ui): TopBar with global coin search, wired into root layout"
```

---

### Task 7: PriceTrendChart（個幣頁放大版 7 日趨勢圖）

**Files:**
- Create: `cryptosense/components/PriceTrendChart.tsx`, `cryptosense/components/PriceTrendChart.test.tsx`

**Interfaces:**
- Produces：`PriceTrendChart({ symbol, data, change7d }: { symbol: string; data: number[]; change7d: number }): JSX.Element | null`（`data.length < 2` 時回傳 `null`，不畫圖）。

- [ ] **Step 1: 寫失敗測試**

`cryptosense/components/PriceTrendChart.test.tsx`：
```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PriceTrendChart } from "./PriceTrendChart";

describe("PriceTrendChart", () => {
  it("states a downward finding with symbol and magnitude", () => {
    render(<PriceTrendChart symbol="ETH" data={[100, 98, 95, 97]} change7d={-2.3} />);
    expect(screen.getByText("ETH 7 日下跌 2.3%")).toBeInTheDocument();
    expect(screen.getByText(/CoinGecko/)).toBeInTheDocument();
  });
  it("states an upward finding when change7d is positive", () => {
    render(<PriceTrendChart symbol="SOL" data={[10, 11, 12]} change7d={9.8} />);
    expect(screen.getByText("SOL 7 日上漲 9.8%")).toBeInTheDocument();
  });
  it("renders nothing when there is not enough data to draw a trend", () => {
    const { container } = render(<PriceTrendChart symbol="ETH" data={[100]} change7d={0} />);
    expect(container).toBeEmptyDOMElement();
  });
});
```

- [ ] **Step 2: 跑測試確認失敗** — Run: `npm test -- PriceTrendChart` → FAIL。

- [ ] **Step 3: 實作**

`cryptosense/components/PriceTrendChart.tsx`：
```tsx
"use client";
import { LineChart, Line, ResponsiveContainer } from "recharts";

function trendTitle(symbol: string, change7d: number): string {
  const dir = change7d >= 0 ? "上漲" : "下跌";
  return `${symbol} 7 日${dir} ${Math.abs(change7d).toFixed(1)}%`;
}

export function PriceTrendChart({ symbol, data, change7d }: { symbol: string; data: number[]; change7d: number }) {
  if (data.length < 2) return null;
  const up = change7d >= 0;
  const last = data[data.length - 1];
  return (
    <div className="rounded-2xl border border-hairline p-4">
      <div className="mb-0.5 text-sm font-semibold text-ink">{trendTitle(symbol, change7d)}</div>
      <div className="mb-2 text-[11px] text-cb-muted">來源：CoinGecko · 7D</div>
      <div className="relative h-24">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data.map((v) => ({ v }))} margin={{ top: 4, right: 56, bottom: 4, left: 0 }}>
            <Line type="monotone" dataKey="v" stroke={up ? "#05b169" : "#b3541f"} dot={false} strokeWidth={2} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
        <span className="absolute right-0 top-1/2 -translate-y-1/2 font-mono text-xs text-ink">
          ${last.toLocaleString()}
        </span>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: 跑測試確認通過** — Run: `npm test -- PriceTrendChart` → PASS。

- [ ] **Step 5: Commit**
```bash
git add cryptosense/components/PriceTrendChart.tsx cryptosense/components/PriceTrendChart.test.tsx
git commit -m "feat(ui): PriceTrendChart — 7d line chart with active-finding title"
```

---

### Task 8: MarketDashboard 重寫（v2 tokens + 搜尋 + 排名箭頭 + 1H/24H/7D + 真實 logo）

**Files:**
- Modify: `cryptosense/components/MarketDashboard.tsx`, `cryptosense/components/MarketDashboard.test.tsx`

**Interfaces:**
- Consumes: `MarketOverview`/`FearGreed`（Task 1 擴充後型別）、`pct`/`usdCompact`/`changeClass`（Task 3）、`Sparkline`、`CoinIcon`（Task 4）。
- Produces：`MarketDashboard({ overview, fearGreed }: { overview: MarketOverview; fearGreed: FearGreed }): JSX.Element`（client component；不新增 props）。

- [ ] **Step 1: 寫失敗測試**

`cryptosense/components/MarketDashboard.test.tsx`（整檔取代）：
```tsx
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { MarketDashboard } from "./MarketDashboard";

const overview = {
  totalMarketCap: 3.42e12, totalVolume: 9.8e10, btcDominance: 54.3,
  coins: [
    { id: "bitcoin", symbol: "BTC", name: "Bitcoin", image: "https://x/btc.png", marketCapRank: 1, price: 67200, change1h: 0.1, change24h: 1.2, change7d: 3.0, marketCap: 1.3e12, spark7d: [1, 2, 3], rankChange: "same" as const },
    { id: "dogecoin", symbol: "DOGE", name: "Dogecoin", image: "https://x/doge.png", marketCapRank: 9, price: 0.12, change1h: -0.4, change24h: -5.2, change7d: -1.0, marketCap: 1e10, spark7d: [3, 2, 1], rankChange: "down" as const },
  ],
};
const fg = { value: 52, label: "Neutral" };

describe("MarketDashboard", () => {
  it("shows KPI tiles (fear/greed, BTC dominance) + up/down-soft by direction", () => {
    render(<MarketDashboard overview={overview} fearGreed={fg} />);
    expect(screen.getByText("52")).toBeInTheDocument();
    expect(screen.getByText("54.3%")).toBeInTheDocument();
    expect(screen.getByTestId("change-bitcoin").className).toMatch(/text-up/);
    expect(screen.getByTestId("change-dogecoin").className).toMatch(/text-down/);
  });

  it("shows 1H and 7D columns alongside 24H", () => {
    render(<MarketDashboard overview={overview} fearGreed={fg} />);
    expect(screen.getByTestId("change1h-bitcoin")).toHaveTextContent("0.10%");
    expect(screen.getByTestId("change7d-bitcoin")).toHaveTextContent("3.00%");
  });

  it("links coin rows to detail page and renders a coin logo", () => {
    render(<MarketDashboard overview={overview} fearGreed={fg} />);
    const link = screen.getByRole("link", { name: /Bitcoin/ });
    expect(link).toHaveAttribute("href", "/coin/bitcoin");
    // Bitcoin also appears in the movers band (it's a gainer), so scope the
    // image lookup to this row's own link instead of querying the whole page.
    expect(within(link).getByRole("img")).toHaveAttribute("src", "https://x/btc.png");
  });

  it("does not list the same coin in both gainers and losers", () => {
    render(<MarketDashboard overview={overview} fearGreed={fg} />);
    const gainers = screen.getByTestId("gainers").textContent ?? "";
    const losers = screen.getByTestId("losers").textContent ?? "";
    expect(gainers).toContain("BTC");
    expect(gainers).not.toContain("DOGE");
    expect(losers).toContain("DOGE");
    expect(losers).not.toContain("BTC");
  });

  it("filters the ranking table by name or symbol as the user types", () => {
    render(<MarketDashboard overview={overview} fearGreed={fg} />);
    expect(screen.getByText("Dogecoin")).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText("搜尋幣種..."), { target: { value: "btc" } });
    expect(screen.queryByText("Dogecoin")).toBeNull();
    expect(screen.getByText("Bitcoin")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 跑測試確認失敗** — Run: `npm test -- MarketDashboard` → FAIL（舊元件沒有 1H 欄、搜尋框、真實 logo，且 `text-green`/`text-red` 已在 Task 3 改名）。

- [ ] **Step 3: 實作**

`cryptosense/components/MarketDashboard.tsx`（整檔取代）：
```tsx
"use client";
import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import type { MarketOverview, FearGreed } from "@/lib/tools/market";
import { pct, usdCompact, changeClass } from "@/lib/format";
import { Sparkline } from "./Sparkline";
import { CoinIcon } from "./CoinIcon";

type Coin = MarketOverview["coins"][number];

function RankChange({ rankChange }: { rankChange: Coin["rankChange"] }) {
  if (rankChange === "up") return <span className="text-up">▲</span>;
  if (rankChange === "down") return <span className="text-down-soft">▼</span>;
  return <span className="text-cb-muted">–</span>;
}

function MoverRow({ c }: { c: Coin }) {
  return (
    <div className="flex items-center justify-between gap-2 border-t border-hairline-soft py-1.5 first:border-t-0">
      <div className="flex items-center gap-2">
        <CoinIcon image={c.image} symbol={c.symbol} size={20} />
        <span className="font-semibold text-cb-muted">{c.symbol}</span>
      </div>
      {c.spark7d.length > 1 && <div className="w-12"><Sparkline data={c.spark7d} up={c.change24h >= 0} /></div>}
      <span className={changeClass(c.change24h)}>{pct(c.change24h)}</span>
    </div>
  );
}

export function MarketDashboard({ overview, fearGreed }: { overview: MarketOverview; fearGreed: FearGreed }) {
  const [query, setQuery] = useState("");
  const sorted = [...overview.coins].sort((a, b) => b.change24h - a.change24h);
  // 依漲跌正負分流，避免幣數少時同一幣同時出現在漲幅榜與跌幅榜
  const gainers = sorted.filter((c) => c.change24h >= 0).slice(0, 3);
  const losers = sorted.filter((c) => c.change24h < 0).slice(-3).reverse();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return overview.coins;
    return overview.coins.filter((c) => c.name.toLowerCase().includes(q) || c.symbol.toLowerCase().includes(q));
  }, [overview.coins, query]);

  const Tile = ({ label, value, sub, subClass = "" }: { label: string; value: ReactNode; sub?: ReactNode; subClass?: string }) => (
    <div className="flex-1 rounded-2xl border border-hairline bg-canvas p-4">
      <div className="text-[10px] uppercase tracking-wide text-cb-muted">{label}</div>
      <div className="text-2xl font-semibold text-ink">{value}</div>
      <div className={`text-sm ${subClass}`}>{sub}</div>
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="flex gap-3">
        <Tile label="恐懼貪婪" value={fearGreed.value} sub={`😐 ${fearGreed.label}`} subClass="text-down-soft" />
        <Tile label="總市值" value={usdCompact(overview.totalMarketCap)} />
        <Tile label="24h 量" value={usdCompact(overview.totalVolume)} />
        <Tile label="BTC 主導" value={`${overview.btcDominance.toFixed(1)}%`} />
      </div>
      <div className="flex gap-3">
        <div data-testid="gainers" className="flex-1 rounded-2xl border border-hairline bg-canvas p-4">
          <div className="text-xs font-medium text-up">▲ 漲幅榜</div>
          {gainers.map((c) => <MoverRow key={c.id} c={c} />)}
        </div>
        <div data-testid="losers" className="flex-1 rounded-2xl border border-hairline bg-canvas p-4">
          <div className="text-xs font-medium text-down-soft">▼ 跌幅榜</div>
          {losers.map((c) => <MoverRow key={c.id} c={c} />)}
        </div>
      </div>
      <div className="rounded-2xl border border-hairline bg-canvas p-4">
        <div className="mb-2 flex items-center justify-between">
          <div className="text-[10px] uppercase tracking-wide text-cb-muted">市值排行</div>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜尋幣種..."
            aria-label="搜尋幣種"
            className="rounded-md border border-hairline px-2 py-1 text-xs text-ink placeholder:text-cb-muted"
          />
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-cb-muted">
              <th className="py-2">#</th><th>幣</th><th className="text-right">價格</th>
              <th className="text-right">1H</th><th className="text-right">24H</th><th className="text-right">7D</th><th>趨勢(7D)</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c, i) => (
              <tr key={c.id} className="border-t border-hairline-soft odd:bg-soft/40 hover:bg-soft">
                <td className="py-2.5 font-mono text-xs text-cb-muted">
                  <RankChange rankChange={c.rankChange} /> {c.marketCapRank || i + 1}
                </td>
                <td>
                  <Link className="flex items-center gap-2 py-1 text-ink hover:underline" href={`/coin/${c.id}`}>
                    <CoinIcon image={c.image} symbol={c.symbol} />
                    <span className="font-semibold">{c.name}</span>
                    <span className="text-cb-muted">{c.symbol}</span>
                  </Link>
                </td>
                <td className="text-right font-mono tabular-nums">${c.price.toLocaleString()}</td>
                <td data-testid={`change1h-${c.id}`} className={`text-right font-mono tabular-nums ${changeClass(c.change1h)}`}>{pct(c.change1h)}</td>
                <td data-testid={`change-${c.id}`} className={`text-right font-mono tabular-nums ${changeClass(c.change24h)}`}>{pct(c.change24h)}</td>
                <td data-testid={`change7d-${c.id}`} className={`text-right font-mono tabular-nums ${changeClass(c.change7d)}`}>{pct(c.change7d)}</td>
                <td className="w-24">{c.spark7d.length > 1 && <Sparkline data={c.spark7d} up={c.change24h >= 0} />}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <p className="py-6 text-center text-sm text-cb-muted">找不到符合「{query}」的幣種</p>}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: 跑測試確認通過** — Run: `npm test -- MarketDashboard` → PASS。`npm run typecheck` 乾淨。

- [ ] **Step 5: Commit**
```bash
git add cryptosense/components/MarketDashboard.tsx cryptosense/components/MarketDashboard.test.tsx
git commit -m "feat(ui): MarketDashboard — v2 tokens, search, 1H/24H/7D, real coin logos"
```

---

### Task 9: CoinDetail 重寫（v2 tokens + 4 格統計 + 趨勢圖 + 真實 logo + CTA 改樣式）

**Files:**
- Modify: `cryptosense/components/CoinDetail.tsx`, `cryptosense/components/CoinDetail.test.tsx`

**Interfaces:**
- Consumes: `CoinData`（Task 2 擴充後型別）、`NewsItem`、`pct`/`changeClass`/`usdCompact`/`numCompact`（Task 3）、`CoinIcon`（Task 4）、`PriceTrendChart`（Task 7）。
- Produces：`CoinDetail({ coin, news, updatedAt, newsError }): JSX.Element`（props 型別不變，僅內部渲染改變）。

- [ ] **Step 1: 寫失敗測試**

`cryptosense/components/CoinDetail.test.tsx`（整檔取代）：
```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CoinDetail } from "./CoinDetail";

const coin = {
  id: "ethereum", symbol: "ETH", name: "Ethereum", image: "https://x/eth.png", marketCapRank: 2,
  price: 3540.18, change24h: -0.82, change7d: -2.3, marketCap: 4.256e11, volume24h: 1.8e10,
  circulatingSupply: 1.202e8, spark7d: [3600, 3580, 3550, 3540],
};
const news = [{ title: "ETF approved", url: "http://a", publishedAt: "2026-06-18T00:00:00Z" }];

describe("CoinDetail", () => {
  it("renders header, real logo, stat grid, trend chart, sources, news, AI prompt", () => {
    render(<CoinDetail coin={coin} news={news} updatedAt="2026-06-19 14:32" />);
    expect(screen.getByText(/Ethereum/)).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "ETH" })).toHaveAttribute("src", "https://x/eth.png");
    // 4 格統計
    expect(screen.getByText("#2")).toBeInTheDocument();
    expect(screen.getByText(/425\.6[BK]?/)).toBeInTheDocument(); // 市值 usdCompact
    // 趨勢圖主動陳述標題
    expect(screen.getByText("ETH 7 日下跌 2.3%")).toBeInTheDocument();
    expect(screen.getByText(/我現在該進場/)).toBeInTheDocument();
    expect(screen.getByText(/資料來源：CoinGecko/)).toBeInTheDocument();
    expect(screen.getByText(/來源：CoinTelegraph/)).toBeInTheDocument();
    expect(screen.queryByText(/利多|利空|中性/)).toBeNull();
    expect(screen.getByTestId("coin-change").className).toMatch(/text-down/);
    const link = screen.getByRole("link", { name: /ETF approved/ });
    expect(link).toHaveAttribute("href", "http://a");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
  });

  it("renders news with an unparseable date without crashing (no date shown)", () => {
    const badNews = [{ title: "Weird date item", url: "http://b", publishedAt: "not-a-date" }];
    render(<CoinDetail coin={coin} news={badNews} updatedAt="t" />);
    expect(screen.getByRole("link", { name: /Weird date item/ })).toBeInTheDocument();
    expect(screen.queryByText(/Invalid Date/)).toBeNull();
  });

  it("shows empty-news note when no news", () => {
    render(<CoinDetail coin={coin} news={[]} updatedAt="t" />);
    expect(screen.getByText(/近期無新聞/)).toBeInTheDocument();
  });

  it("shows a load-failure note (not 'no news') when news errored", () => {
    render(<CoinDetail coin={coin} news={[]} newsError="HTTP 500" updatedAt="t" />);
    expect(screen.getByText(/新聞暫時無法載入/)).toBeInTheDocument();
    expect(screen.queryByText(/近期無新聞/)).toBeNull();
  });

  it("omits the trend chart when there is not enough sparkline data", () => {
    const thinCoin = { ...coin, spark7d: [3540] };
    render(<CoinDetail coin={thinCoin} news={[]} updatedAt="t" />);
    expect(screen.queryByText(/7 日/)).toBeNull();
  });
});
```

- [ ] **Step 2: 跑測試確認失敗** — Run: `npm test -- CoinDetail` → FAIL。

- [ ] **Step 3: 實作**

`cryptosense/components/CoinDetail.tsx`（整檔取代）：
```tsx
import type { CoinData } from "@/lib/tools/coin";
import type { NewsItem } from "@/lib/tools/news";
import { pct, changeClass, usdCompact, numCompact } from "@/lib/format";
import { CoinIcon } from "./CoinIcon";
import { PriceTrendChart } from "./PriceTrendChart";

function safeLocalDate(pubDate: string): string {
  try {
    const d = new Date(pubDate);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString("zh-TW");
  } catch {
    return "";
  }
}

export function CoinDetail({ coin, news, updatedAt, newsError }: { coin: CoinData; news: NewsItem[]; updatedAt: string; newsError?: string }) {
  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between">
        <div className="flex items-center gap-3">
          <CoinIcon image={coin.image} symbol={coin.symbol} size={36} />
          <div>
            <div className="text-[10px] uppercase tracking-wide text-cb-muted">{coin.name} · {coin.symbol}</div>
            <div className="font-mono text-3xl font-medium tabular-nums text-ink">
              ${coin.price.toLocaleString()}{" "}
              <span data-testid="coin-change" className={`text-sm ${changeClass(coin.change24h)}`}>{pct(coin.change24h)} (24h)</span>
            </div>
          </div>
        </div>
        <div className="text-right text-xs text-cb-muted">資料更新<br />{updatedAt}</div>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <div className="rounded-xl border border-hairline p-3">
          <div className="text-[10px] uppercase text-cb-muted">市值排名</div>
          <div className="font-mono text-[15px] font-medium text-ink">{coin.marketCapRank ? `#${coin.marketCapRank}` : "—"}</div>
        </div>
        <div className="rounded-xl border border-hairline p-3">
          <div className="text-[10px] uppercase text-cb-muted">市值</div>
          <div className="font-mono text-[15px] font-medium text-ink">{usdCompact(coin.marketCap)}</div>
        </div>
        <div className="rounded-xl border border-hairline p-3">
          <div className="text-[10px] uppercase text-cb-muted">24H 量</div>
          <div className="font-mono text-[15px] font-medium text-ink">{usdCompact(coin.volume24h)}</div>
        </div>
        <div className="rounded-xl border border-hairline p-3">
          <div className="text-[10px] uppercase text-cb-muted">流通量</div>
          <div className="font-mono text-[13px] font-medium text-ink">{numCompact(coin.circulatingSupply)} {coin.symbol}</div>
        </div>
      </div>
      <div className="text-[10px] text-cb-primary">資料來源：CoinGecko · {updatedAt}</div>

      <PriceTrendChart symbol={coin.symbol} data={coin.spark7d} change7d={coin.change7d} />

      <section className="rounded-2xl border border-hairline p-4">
        <h2 className="mb-2 font-semibold text-ink">📰 近期新聞</h2>
        {newsError
          ? <p className="text-cb-muted">新聞暫時無法載入，請稍後再試。</p>
          : news.length ? news.map((n, i) => {
            const dateStr = safeLocalDate(n.publishedAt);
            return (
              <div key={n.url ?? i} className="border-t border-hairline-soft py-1 text-sm">
                <a className="text-ink hover:underline" href={n.url} target="_blank" rel="noopener noreferrer">{n.title}</a>
                {dateStr && <span className="ml-2 text-xs text-cb-muted">{dateStr}</span>}
              </div>
            );
          }) : <p className="text-cb-muted">近期無新聞。</p>}
        <div className="mt-1 text-[10px] text-cb-muted">來源：CoinTelegraph · {updatedAt}</div>
      </section>

      <a
        href="#ai-chat"
        className="flex items-center justify-center gap-2 rounded-2xl border border-hairline bg-soft py-3 text-sm font-medium text-ink hover:bg-strong"
      >
        💬 針對 {coin.symbol} 問 AI：「我現在該進場嗎？」
      </a>
    </div>
  );
}
```

- [ ] **Step 4: 跑測試確認通過** — Run: `npm test -- CoinDetail` → PASS。`npm run typecheck` 乾淨。

- [ ] **Step 5: Commit**
```bash
git add cryptosense/components/CoinDetail.tsx cryptosense/components/CoinDetail.test.tsx
git commit -m "feat(ui): CoinDetail — v2 tokens, stat grid, 7d trend chart, real logo"
```

---

### Task 10: 頁面收尾（breadcrumb 樣式 + AI 錨點目標）

**Files:**
- Modify: `cryptosense/app/page.tsx`, `cryptosense/app/coin/[id]/page.tsx`

**Interfaces:**
- Consumes: `MarketDashboard`（Task 8）、`CoinDetail`（Task 9）、`Chat`（既有，未改動）。

- [ ] **Step 1: 實作 `app/page.tsx`**（整檔取代——移除舊深色標題，改為與 `TopBar` 呼應的淡出 breadcrumb）：
```tsx
import { MarketDashboard } from "@/components/MarketDashboard";
import { getMarketOverview, getFearGreedIndex } from "@/lib/tools/market";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [overview, fearGreed] = await Promise.all([getMarketOverview(), getFearGreedIndex()]);
  return (
    <main className="mx-auto max-w-5xl p-6">
      <p className="mb-4 text-xs text-cb-muted">市場總覽 · 分析型摘要</p>
      {overview.data && fearGreed.data
        ? <MarketDashboard overview={overview.data} fearGreed={fearGreed.data} />
        : <p className="text-cb-muted">市場資料暫時取不到，請稍後再試。</p>}
    </main>
  );
}
```

- [ ] **Step 2: 實作 `app/coin/[id]/page.tsx`**（整檔取代——加 breadcrumb + `#ai-chat` 錨點目標給 `CoinDetail` 底部的 CTA 連結用）：
```tsx
import { Chat } from "@/components/Chat";
import { CoinDetail } from "@/components/CoinDetail";
import { getCoinData } from "@/lib/tools/coin";
import { getCryptoNews } from "@/lib/tools/news";

export const dynamic = "force-dynamic";

export default async function CoinPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const coin = await getCoinData(id);
  const newsRes = coin.data ? await getCryptoNews(coin.data.symbol) : null;
  return (
    <main className="mx-auto max-w-3xl p-6">
      {coin.data
        ? <>
            <p className="mb-4 text-xs text-cb-muted">市場 / {coin.data.name}</p>
            <CoinDetail coin={coin.data} news={newsRes?.data ?? []} newsError={newsRes?.error} updatedAt={new Date(coin.timestamp).toLocaleString()} />
            <div id="ai-chat" className="mt-6 scroll-mt-20">
              <Chat coinId={coin.data.id} symbol={coin.data.symbol} />
            </div>
          </>
        : <p className="text-cb-muted">找不到此幣資料。</p>}
    </main>
  );
}
```

- [ ] **Step 3: Typecheck** — Run: `cd cryptosense && npm run typecheck` → 乾淨（這兩個檔案沒有獨立單元測試，行為由 Task 8/9 的元件測試 + Task 11 的手動驗證涵蓋）。

- [ ] **Step 4: Commit**
```bash
git add cryptosense/app/page.tsx "cryptosense/app/coin/[id]/page.tsx"
git commit -m "feat(ui): page breadcrumbs + #ai-chat anchor target for CoinDetail CTA"
```

---

### Task 11: 全套驗證 + README 更新

**Files:**
- Modify: `cryptosense/README.md`

- [ ] **Step 1: 全套測試 + typecheck + build** — Run: `cd cryptosense && npm test` → 全綠；`npm run typecheck` → 乾淨；`npm run build` → 成功。

- [ ] **Step 2: 手動驗證（dev）** — Run: `npm run dev`，開 `http://localhost:3000`：
  - 首頁：頂列出現 wordmark + 搜尋框；市值表有 1H/24H/7D 三欄、排名箭頭、真實幣種 logo（若圖片載入失敗會退回代號首字母圓點，不應該整頁壞掉）；市值表搜尋框輸入「sol」只剩 Solana 那一列；漲跌幅榜出現 mini sparkline。
  - 頂列搜尋框輸入「bit」，下拉出現 Bitcoin，點擊後跳到 `/coin/bitcoin`。
  - 進 `/coin/ethereum`：4 格統計（排名/市值/24H量/流通量）都有數字；下方出現 7 日趨勢圖，標題是「ETH 7 日上漲/下跌 X%」這種主動陳述句；底部「問 AI」錨點點擊後平滑捲動到下方 AI 問答（`#ai-chat`）。
  - AI 問答本身（Chat/CitationPanel/守門）維持既有行為不變——沒有改動 `lib/ai/*`，`docs/redteam-checklist.md` 的案例不需要重跑。

- [ ] **Step 3: 更新 README 測試數與功能描述**

`cryptosense/README.md`：把 `npm test    # 38 tests` 改成本次全部完成後 `npm test` 實際印出的通過數（跑 Step 1 時記下 `Tests  N passed`），並在技術描述加一句聚合器化調整的重點：
```diff
- npm test                            # 38 tests
+ npm test                            # <實際數字> tests
```
及在第 6 行技術描述後加一句：
```
- 市場總覽：CoinMarketCap/CoinGecko 風格（全站搜尋、1H/24H/7D、排名變動、真實幣種 logo）
```

- [ ] **Step 4: Commit**
```bash
git add cryptosense/README.md
git commit -m "docs: update test count and note aggregator-style market overview"
```

---

## Self-Review

- **Spec coverage**：對照 `docs/superpowers/specs/2026-07-02-cryptosense-aggregator-ui-refresh-design.md`——§3.1 市值表（Task 8）、§3.2 漲跌幅榜 mini sparkline（Task 8 的 `MoverRow`）、§3.3 頂列搜尋（Task 5+6）、§3.4 個幣頁統計格+趨勢圖（Task 7+9）、§3.5 型別變更（Task 1+2）、§3.6 `searchCoins`（Task 5）全部有對應 task。§2 的「密度取中間值」（列高微調而非維持極密）落實在 Task 8 的 `p-4`/`py-2.5`/`py-1.5` 間距（相對舊版 `p-3`/純密集列略寬鬆一級）。
- **額外發現並補上的落差**：`MarketDashboard.tsx`/`CoinDetail.tsx`/`format.ts`/`Sparkline.tsx` 施工前仍是 P1 舊版深色 Tailwind（`bg-slate-900`/`text-green-500` 等），從未真的套用已核准的 `DESIGN-v2-research-driven.md`；Task 3/8/9 把這個遷移一併做掉，而非留著不一致的視覺基底疊加新功能。
- **Placeholder scan**：無 TBD；每個 step 都有完整程式碼；版本/資料不確定處（CoinGecko 圖片 CDN 可能偶爾載入失敗、排名變動只是記憶體內近似值）都在程式碼註解與 Global Constraints 中明講，不是含糊帶過。
- **Type consistency**：`MarketCoin`/`CoinData` 新欄位命名在 Task 1/2（型別定義）、Task 8/9（元件消費）、對應測試三處一致（`image`/`marketCapRank`/`change1h`/`change24h`/`change7d`/`rankChange`/`spark7d`）；`CoinIcon`/`PriceTrendChart` 的 props 簽名在建立（Task 4/7）與使用（Task 6/8/9）處一致。
- **無 DB、無新增 AI 工具**：`searchCoins`/`/api/search` 明確標註「非 AI 工具」，`lib/ai/tools.ts`（`makeCryptoTools`）完全未被本計畫觸碰，AI 問答仍是剛好 3 支工具。
- **已知取捨（沿用 design spec 的排除清單）**：不做分類篩選 tabs、不做 watchlist 星號、不做 1D/1M/1Y 圖表時間窗、不做 trending 跑馬燈——本計畫的任何 task 都沒有暗中把這些加回來。
- **技術方案並行驗證（6 個獨立 Context7/WebSearch 研究 agent，2026-07-02）**：Next.js 16 Route Handler、Tailwind v4 tokens、Vitest/Testing Library、Recharts、CoinGecko API v3 schema、防抖搜尋 UX 六個領域逐一查證後，已將發現的 3 處修正套進對應 task（Task 5 route.ts 改用 `NextRequest`/`request.nextUrl.searchParams`；Task 6 TopBar 的下拉選單改用 `onMouseDown` preventDefault 取代計時器賽跑並補上最低限度 ARIA、`next/navigation` mock 補齊 `usePathname`/`useSearchParams`）。其餘經查證均與現行官方文件/社群主流做法一致，未做改動（Tailwind `@theme inline` 寫法、`ResponsiveContainer` 在 jsdom 下只斷言文字不斷言圖表內部、CoinGecko 三支 endpoint 的欄位假設）。
