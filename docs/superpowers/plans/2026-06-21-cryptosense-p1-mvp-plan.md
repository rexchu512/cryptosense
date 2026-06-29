# CryptoSense P1 (最小可 Demo MVP) Implementation Plan — v3（依 2026-06-20 feedback 重新分期）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 做出可 demo 的加密貨幣 AI 研究助手「產品」MVP：市場總覽 Dashboard、**精簡個幣分析頁（行情＋新聞）**、情境感知 AI 問答（**剛好 3 支工具**：即時行情 / 新聞 / 個人知識庫 + 串流 + 工具步驟顯示），對應 spec 的 F1–F4。**P1 不含 DB、不含技術面/K 線圖、不含風險彙整卡、不含觀測分析**（全部後移，見 spec §6）。

**Architecture:** 單一 Next.js (App Router) repo。資料工具（CoinGecko / Alternative.me / CryptoPanic）為純函式，回傳一律帶 `source`/`timestamp`，並有**記憶體快取（Map + TTL）與 stale fallback**（無 DB）。AI 問答用 **Vercel AI SDK v5** 的 `streamText` + `tool()`（**剛好 3 支工具**：`getCoinData` / `getCryptoNews` / `searchKnowledgeBase`）+ 多步工具迴圈，前端用 `useChat` 並渲染工具步驟。個人知識庫用 **OpenAI File Search**（hosted 向量庫＋檢索，不自建）。

**Tech Stack:** Next.js 15+ (App Router) · TypeScript · Tailwind · Vitest + @testing-library/react + vite-tsconfig-paths · Vercel AI SDK v5 (`ai`, `@ai-sdk/openai`, `@ai-sdk/react`) · `openai`（File Search ingest/search）· `recharts`（sparkline）· `react-markdown` + `remark-gfm`。

## 與 v2.1 計畫的差異（依 feedback）

| 變更 | 說明 | 去向 |
|------|------|------|
| 移除 Railway Postgres（query_logs / feedback） | P1 不碰 DB；對話歷史與行為紀錄一律 P2 起 | **P2** |
| 移除技術指標（RSI/MACD/均線）+ K 線圖 | getOHLCV / calcTechnicalSignals 是技術面前置依賴 | **P2** |
| AI 工具改為 3 支：`getCoinData` / `getCryptoNews` / `searchKnowledgeBase` | 取代 v2.1 的 `getCoinAnalysis`(併行情/技術/新聞) + `getMarketOverview` | — |
| `getMarketOverview` 不再是 AI 工具 | Dashboard 頁直接用 lib 函式撈，不需當 tool | 僅供頁面 |
| 移除 👍/👎 回饋按鈕 | 需 DB 才有意義 | **P2** |
| 串流 UI 強化：顯示工具步驟 | 「取得行情 → 檢索新聞 → 查知識庫 → 彙整中」 | P1 保留 |

## 技術選型與依據（每個選型都附研究來源）

| 選型 | 依據（來自 Context7 研究） |
|------|---------------------------|
| **Vercel AI SDK v5（非原生 OpenAI SDK）** | 兩個獨立研究 agent 一致建議：本專案核心需求（多資料工具串接、串流合成答案、Next.js 前端渲染）AI SDK 全內建；原生 SDK 須手寫工具迴圈、SSE 串流、tool_calls 分片拼接、等效 `useChat`，投報率低。來源：Vercel AI SDK v5 官方文件 `chatbot-tool-usage.mdx`、`call-tools-multiple-steps.mdx`。 |
| **`streamText` + `stopWhen: stepCountIs(n)`** | v5 內建多步工具迴圈，設步數上限防失控。來源：`call-tools-multiple-steps.mdx`、agents.mdx。 |
| **AI 工具精簡為 3 支**（即時行情 / 新聞 / 知識庫） | 一個問答要回答任一幣的基本問題（行情）＋風險核心資料來源（新聞）＋個人差異化（知識庫）；控制 token 與工具迴圈複雜度。依據：feedback「AI 工具只帶 3 點」。 |
| **RAG 用 OpenAI File Search（不自建向量庫）** | hosted 向量庫＋檢索＋引用一站式，免維運嵌入/索引/相似度。依據：feedback + OpenAI File Search 為 hosted 方案。 |
| **快取用記憶體 Map + TTL + stale fallback（無 DB）** | P1 不引入 DB；對外部 API 配額友善、429 時回上次成功資料。依據：feedback「API 快取＝記憶體 Map + TTL」、CoinGecko rate-limit 研究。 |
| **`useChat` + `message.parts`（前端）** | 訊息為結構化 parts（text/tool/source），天生適合「文字＋工具步驟＋來源」混排；自動管理串流/status/stop。`tool-*` parts 可渲染工具調用步驟。來源：AI SDK v5 `02-chatbot.mdx`、`generative-user-interfaces.mdx`。 |
| **`react-markdown` + `remark-gfm`** | 預設不使用 `dangerouslySetInnerHTML`，防 XSS；串流友善（半截 markdown 後續補上）。來源：`remarkjs/react-markdown` Security。 |
| **CoinGecko Demo key（`x-cg-demo-api-key`）+ 30/min、10k/月 預算** | 免費穩定額度需 Demo key；保守以 30/min 規劃。來源：CoinGecko docs common-errors-rate-limit、setting-up-your-api-key。 |
| **CryptoPanic developer **v2** URL + 最長 TTL** | v1 已轉 v2，base URL 改 `…/api/developer/v2/posts/`，免費月額度僅約 1000（最稀缺）。來源：CryptoPanic developers API、dltHub 文件。 |
| **`recharts`（sparkline）** | 宣告式適合迷你走勢圖；P1 唯一用到的圖表（K 線圖在 P2）。來源：`recharts/recharts` v3。 |
| **測試：`node` 環境跑純函式、`ai/test` 的 Mock model 測 LLM、`vite-tsconfig-paths`** | async Server Component 官方建議用 E2E 不用 Vitest；LLM 走 provider 抽象注入 mock model 最確定性。來源：Next.js testing/vitest.mdx、AI SDK `55-testing.mdx`。 |

## Global Constraints

- 專案位置：`claude專案/cryptosense/`（獨立 npm 專案）。
- 部署目標：**Railway（僅 Web Service，P1 不掛 Postgres）**。需可建置出 production Next.js 並在 Railway 上以公開網址運行；env 機密在 Railway 專案變數設定。避免依賴 Vercel 專屬功能；`/api/chat` 串流用標準 Web Streams 即可跨平台。（「Vercel AI SDK」是函式庫名稱，與部署平台無關，照用。）
- 機密金鑰走 env：`OPENAI_API_KEY`、`COINGECKO_DEMO_KEY`、`CRYPTOPANIC_TOKEN`、`OPENAI_VECTOR_STORE_ID`（File Search 知識庫 id）（放 `.env.local`，不入 git）。**P1 無 `DATABASE_URL`。** 對外資料模組頂部加 `import "server-only"`。
- 資料工具回傳型別一律 `ToolResult<T> = { data: T | null; source: string; timestamp: string; error?: string }`；錯誤回 `error` 且 `data:null`，**不得編造數字**。
- 顏色：**綠漲紅跌**（crypto 慣例），全站統一；狀態用「圖示＋文字＋顏色」三重編碼。
- 只用免費/公開 API；每個外部呼叫帶記憶體快取 TTL 並有 stale fallback。TTL：markets 90s、global 300s、coin 180s、F&G 3600s、**CryptoPanic 1200s（額度最稀缺）**。
- TDD：含邏輯的 task 先寫失敗測試。純函式測試用 `node` 環境。頻繁 commit。
- 對應 spec 成功條件：見 [spec](../specs/2026-06-19-cryptosense-spec.md) §5。
- 執行順序：RAG（File Search，Task 8）排在 AI 問答（Task 9）之前完成，呼應「先把 RAG 建構出來」。
- P1 **不做**：自建向量庫、DB（對話歷史/行為紀錄/風險歷史）、技術面指標/K 線圖、風險彙整卡、👍/👎 回饋、鏈上數據、GA4/觀測分析、影片/圖片。

## File Structure

```
cryptosense/
├── lib/
│   ├── tools/
│   │   ├── types.ts          # ToolResult<T>
│   │   ├── http.ts           # ok/fail + cachedFetch（記憶體快取 + stale fallback）
│   │   ├── market.ts         # getMarketOverview + getFearGreedIndex（給 Dashboard）
│   │   ├── coin.ts           # getCoinData（無 OHLCV）
│   │   └── news.ts           # getCryptoNews（CryptoPanic v2）
│   ├── rag/
│   │   └── fileSearch.ts     # searchKnowledgeBase（OpenAI File Search）
│   ├── ai/
│   │   ├── prompt.ts         # SYSTEM_PROMPT
│   │   ├── tools.ts          # cryptoTools：3 支
│   │   └── chat.ts           # runChat（streamText，model 可注入）
│   └── format.ts             # pct / usdCompact / changeClass
├── components/
│   ├── Sparkline.tsx
│   ├── MarketDashboard.tsx
│   ├── CoinDetail.tsx        # header + 新聞 + AI CTA（無圖表/技術面）
│   └── Chat.tsx              # useChat + markdown + chips + 工具步驟
├── scripts/
│   └── ingest.ts             # 離線把 knowledge/ 上傳建立向量庫
├── knowledge/                # 個人知識庫文字檔
└── app/
    ├── page.tsx              # 市場總覽
    ├── coin/[id]/page.tsx    # 個幣頁 + Chat
    └── api/
        ├── market/route.ts
        ├── coin/[id]/route.ts
        └── chat/route.ts
```

---

### Task 0: 專案 scaffold 與測試環境

**Files:**
- Create: `cryptosense/`（Next.js 專案）、`cryptosense/vitest.config.mts`、`cryptosense/vitest.setup.ts`、`cryptosense/.env.local.example`、`cryptosense/lib/smoke.test.ts`

**Interfaces:**
- Produces: 可運行的 Next.js 專案；`npm test` 跑 Vitest（jsdom + node 分層）；AI SDK 與 sparkline/markdown 套件就緒。

- [ ] **Step 1: 建立 Next.js 專案**

```bash
cd "C:/Users/user/OneDrive/Desktop/claude專案"
npx create-next-app@latest cryptosense --typescript --tailwind --app --eslint --src-dir=false --import-alias "@/*" --no-turbopack
cd cryptosense
```

- [ ] **Step 2: 安裝相依套件（P1 範圍，不含 technicalindicators / lightweight-charts / postgres）**

```bash
npm install ai @ai-sdk/openai @ai-sdk/react zod openai recharts react-markdown remark-gfm server-only
npm install -D vitest @vitejs/plugin-react @testing-library/react @testing-library/user-event @testing-library/jest-dom jsdom vite-tsconfig-paths tsx
npx shadcn@latest init -d
```

- [ ] **Step 3: 設定 Vitest（node/jsdom 分層 + path alias）**

`cryptosense/vitest.config.mts`:
```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    globals: true,
    restoreMocks: true,
    unstubGlobals: true,
  },
});
```

`cryptosense/vitest.setup.ts`:
```ts
import "@testing-library/jest-dom/vitest";
```

`package.json` scripts 加：`"test": "vitest run"`, `"test:watch": "vitest"`。

> 純函式測試檔（如資料工具）首行加 `// @vitest-environment node` 以跳過 jsdom，加速。

- [ ] **Step 4: env 範例**

`cryptosense/.env.local.example`:
```
OPENAI_API_KEY=sk-...
COINGECKO_DEMO_KEY=
CRYPTOPANIC_TOKEN=
OPENAI_VECTOR_STORE_ID=
```

- [ ] **Step 5: 冒煙測試**

`cryptosense/lib/smoke.test.ts`:
```ts
import { describe, it, expect } from "vitest";
describe("smoke", () => { it("runs", () => { expect(1 + 1).toBe(2); }); });
```
Run: `npm test` → Expected: 1 passed。

- [ ] **Step 6: Commit**

```bash
git add cryptosense
git commit -m "chore: scaffold cryptosense (Next.js + AI SDK v5 + Vitest, P1 deps)"
```

---

### Task 1: 共用型別 + 帶 key/快取/stale fallback 的 fetch

**Files:**
- Create: `cryptosense/lib/tools/types.ts`, `cryptosense/lib/tools/http.ts`, `cryptosense/lib/tools/http.test.ts`

**Interfaces:**
- Produces:
  - `type ToolResult<T> = { data: T | null; source: string; timestamp: string; error?: string }`
  - `function ok<T>(data: T, source: string): ToolResult<T>`
  - `function fail(source: string, error: string): ToolResult<null>`
  - `function cachedFetch(url: string, opts?: { ttlMs?: number; headers?: Record<string,string> }): Promise<any>` — 帶記憶體快取與 stale fallback（429/錯誤時回上次成功資料）。
  - `function __clearCache(): void`（測試用）

- [ ] **Step 1: 寫失敗測試**

`cryptosense/lib/tools/http.test.ts`:
```ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ok, fail, cachedFetch, __clearCache } from "./http";

beforeEach(() => __clearCache());

describe("ok/fail", () => {
  it("ok wraps data with source + ISO timestamp", () => {
    const r = ok({ x: 1 }, "CoinGecko");
    expect(r.data).toEqual({ x: 1 });
    expect(r.source).toBe("CoinGecko");
    expect(() => new Date(r.timestamp).toISOString()).not.toThrow();
  });
  it("fail returns null data + error", () => {
    expect(fail("CoinGecko", "boom")).toMatchObject({ data: null, error: "boom" });
  });
});

describe("cachedFetch", () => {
  it("caches within TTL (single network call)", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ v: 1 }) });
    vi.stubGlobal("fetch", fetchMock);
    await cachedFetch("http://x", { ttlMs: 1000 });
    await cachedFetch("http://x", { ttlMs: 1000 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("returns stale value on later failure", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ v: 1 }) })
      .mockResolvedValueOnce({ ok: false, status: 429 });
    vi.stubGlobal("fetch", fetchMock);
    const a = await cachedFetch("http://y", { ttlMs: 0 });   // 寫入快取
    const b = await cachedFetch("http://y", { ttlMs: 0 });   // 429 → 回 stale
    expect(a).toEqual({ v: 1 });
    expect(b).toEqual({ v: 1 });
  });
  it("throws when failing with no cached value", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    await expect(cachedFetch("http://z")).rejects.toThrow("HTTP 500");
  });
});
```

- [ ] **Step 2: 跑測試確認失敗** — Run: `npm test -- http` → FAIL。

- [ ] **Step 3: 實作**

`cryptosense/lib/tools/types.ts`:
```ts
export type ToolResult<T> = { data: T | null; source: string; timestamp: string; error?: string };
```

`cryptosense/lib/tools/http.ts`:
```ts
import "server-only";
import type { ToolResult } from "./types";

export function ok<T>(data: T, source: string): ToolResult<T> {
  return { data, source, timestamp: new Date().toISOString() };
}
export function fail(source: string, error: string): ToolResult<null> {
  return { data: null, source, timestamp: new Date().toISOString(), error };
}

const cache = new Map<string, { at: number; value: any }>();
export function __clearCache() { cache.clear(); }

export async function cachedFetch(url: string, opts: { ttlMs?: number; headers?: Record<string, string> } = {}): Promise<any> {
  const { ttlMs = 60_000, headers } = opts;
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < ttlMs) return hit.value;
  try {
    const res = await fetch(url, { headers: { accept: "application/json", ...headers } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const value = await res.json();
    cache.set(url, { at: Date.now(), value });
    return value;
  } catch (e) {
    if (hit) return hit.value; // stale fallback
    throw e;
  }
}
```

- [ ] **Step 4: 跑測試確認通過** — Run: `npm test -- http` → PASS。

- [ ] **Step 5: Commit**

```bash
git add cryptosense/lib/tools/types.ts cryptosense/lib/tools/http.ts cryptosense/lib/tools/http.test.ts
git commit -m "feat: ToolResult types + cached fetch with stale fallback"
```

---

### Task 2: 市場總覽工具（CoinGecko markets + global、F&G）

**Files:**
- Create: `cryptosense/lib/tools/market.ts`, `cryptosense/lib/tools/market.test.ts`

**Interfaces:**
- Consumes: `ok`, `fail`, `cachedFetch`。
- Produces:
  - `type MarketCoin = { id; symbol; name; price; change24h; marketCap; spark7d: number[] }`
  - `type MarketOverview = { totalMarketCap; totalVolume; btcDominance; coins: MarketCoin[] }`
  - `function getMarketOverview(): Promise<ToolResult<MarketOverview>>`（來源 "CoinGecko"，TTL: markets 90s / global 300s，帶 Demo key header）
  - `type FearGreed = { value: number; label: string }`
  - `function getFearGreedIndex(): Promise<ToolResult<FearGreed>>`（來源 "Alternative.me"，TTL 3600s）

- [ ] **Step 1: 寫失敗測試**

`cryptosense/lib/tools/market.test.ts`:
```ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { getMarketOverview, getFearGreedIndex } from "./market";
import { __clearCache } from "./http";

beforeEach(() => __clearCache());

describe("getMarketOverview", () => {
  it("maps markets + global", async () => {
    const markets = [{ id: "bitcoin", symbol: "btc", name: "Bitcoin", current_price: 67200,
      price_change_percentage_24h: 1.2, market_cap: 1.3e12, sparkline_in_7d: { price: [1, 2, 3] } }];
    const global = { data: { total_market_cap: { usd: 3.42e12 }, total_volume: { usd: 9.8e10 }, market_cap_percentage: { btc: 54.3 } } };
    vi.stubGlobal("fetch", vi.fn((u: string) =>
      Promise.resolve({ ok: true, json: () => Promise.resolve(String(u).includes("/global") ? global : markets) })));
    const r = await getMarketOverview();
    expect(r.source).toBe("CoinGecko");
    expect(r.data!.btcDominance).toBe(54.3);
    expect(r.data!.coins[0]).toMatchObject({ id: "bitcoin", symbol: "BTC", price: 67200, change24h: 1.2, spark7d: [1, 2, 3] });
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

- [ ] **Step 2: 跑測試確認失敗** — Run: `npm test -- market` → FAIL。

- [ ] **Step 3: 實作**

`cryptosense/lib/tools/market.ts`:
```ts
import "server-only";
import { ok, fail, cachedFetch } from "./http";
import type { ToolResult } from "./types";

export type MarketCoin = { id: string; symbol: string; name: string; price: number; change24h: number; marketCap: number; spark7d: number[] };
export type MarketOverview = { totalMarketCap: number; totalVolume: number; btcDominance: number; coins: MarketCoin[] };
export type FearGreed = { value: number; label: string };

const CG = "https://api.coingecko.com/api/v3";
const cgHeaders = () => (process.env.COINGECKO_DEMO_KEY ? { "x-cg-demo-api-key": process.env.COINGECKO_DEMO_KEY } : undefined);

export async function getMarketOverview(): Promise<ToolResult<MarketOverview>> {
  try {
    const [markets, global] = await Promise.all([
      cachedFetch(`${CG}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=25&page=1&sparkline=true&price_change_percentage=24h`, { ttlMs: 90_000, headers: cgHeaders() }),
      cachedFetch(`${CG}/global`, { ttlMs: 300_000, headers: cgHeaders() }),
    ]);
    const coins: MarketCoin[] = markets.map((m: any) => ({
      id: m.id, symbol: String(m.symbol).toUpperCase(), name: m.name,
      price: m.current_price, change24h: m.price_change_percentage_24h ?? 0,
      marketCap: m.market_cap, spark7d: m.sparkline_in_7d?.price ?? [],
    }));
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

- [ ] **Step 4: 跑測試確認通過** — Run: `npm test -- market` → PASS。

- [ ] **Step 5: Commit**

```bash
git add cryptosense/lib/tools/market.ts cryptosense/lib/tools/market.test.ts
git commit -m "feat: market overview + fear/greed tools (CoinGecko demo key, TTL)"
```

---

### Task 3: 個幣資料工具（getCoinData，無 OHLCV）

**Files:**
- Create: `cryptosense/lib/tools/coin.ts`, `cryptosense/lib/tools/coin.test.ts`

**Interfaces:**
- Consumes: `ok`, `fail`, `cachedFetch`。
- Produces:
  - `type CoinData = { id; symbol; name; price; change24h; marketCap; volume24h; circulatingSupply }`
  - `function getCoinData(id: string): Promise<ToolResult<CoinData>>`（TTL 180s）

> 註：getOHLCV / K 線圖屬技術面，P2 再加。

- [ ] **Step 1: 寫失敗測試**

`cryptosense/lib/tools/coin.test.ts`:
```ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { getCoinData } from "./coin";
import { __clearCache } from "./http";

beforeEach(() => __clearCache());

describe("getCoinData", () => {
  it("maps coin detail", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({
      id: "ethereum", symbol: "eth", name: "Ethereum",
      market_data: { current_price: { usd: 3540 }, price_change_percentage_24h: -0.82,
        market_cap: { usd: 4.25e11 }, total_volume: { usd: 1.8e10 }, circulating_supply: 1.2e8 } }) }));
    const r = await getCoinData("ethereum");
    expect(r.data).toMatchObject({ id: "ethereum", symbol: "ETH", price: 3540, change24h: -0.82, volume24h: 1.8e10 });
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

`cryptosense/lib/tools/coin.ts`:
```ts
import "server-only";
import { ok, fail, cachedFetch } from "./http";
import type { ToolResult } from "./types";

export type CoinData = { id: string; symbol: string; name: string; price: number; change24h: number; marketCap: number; volume24h: number; circulatingSupply: number };

const CG = "https://api.coingecko.com/api/v3";
const cgHeaders = () => (process.env.COINGECKO_DEMO_KEY ? { "x-cg-demo-api-key": process.env.COINGECKO_DEMO_KEY } : undefined);

export async function getCoinData(id: string): Promise<ToolResult<CoinData>> {
  try {
    const j = await cachedFetch(`${CG}/coins/${id}?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false&sparkline=false`, { ttlMs: 180_000, headers: cgHeaders() });
    const m = j.market_data;
    return ok({ id: j.id, symbol: String(j.symbol).toUpperCase(), name: j.name,
      price: m.current_price.usd, change24h: m.price_change_percentage_24h ?? 0,
      marketCap: m.market_cap.usd, volume24h: m.total_volume.usd, circulatingSupply: m.circulating_supply }, "CoinGecko");
  } catch (e: any) { return fail("CoinGecko", e.message); }
}
```

- [ ] **Step 4: 跑測試確認通過** — Run: `npm test -- coin` → PASS。

- [ ] **Step 5: Commit**

```bash
git add cryptosense/lib/tools/coin.ts cryptosense/lib/tools/coin.test.ts
git commit -m "feat: coin data tool (no OHLCV in P1)"
```

---

### Task 4: 新聞工具（CryptoPanic v2）

**Files:**
- Create: `cryptosense/lib/tools/news.ts`, `cryptosense/lib/tools/news.test.ts`

**Interfaces:**
- Consumes: `ok`, `fail`, `cachedFetch`。
- Produces:
  - `type NewsItem = { title; url; publishedAt; sentiment: "positive"|"negative"|"neutral" }`
  - `function getCryptoNews(symbol?: string): Promise<ToolResult<NewsItem[]>>`（developer v2，TTL 1200s）

- [ ] **Step 1: 寫失敗測試**

`cryptosense/lib/tools/news.test.ts`:
```ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { getCryptoNews } from "./news";
import { __clearCache } from "./http";

beforeEach(() => __clearCache());

describe("getCryptoNews", () => {
  it("maps results and derives sentiment from votes", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ results: [
      { title: "ETF approved", url: "http://a", published_at: "2026-06-18T00:00:00Z", votes: { positive: 10, negative: 1 } },
      { title: "Exchange hacked", url: "http://b", published_at: "2026-06-19T00:00:00Z", votes: { positive: 0, negative: 9 } },
    ] }) });
    vi.stubGlobal("fetch", fetchMock);
    const r = await getCryptoNews("ETH");
    expect(r.source).toBe("CryptoPanic");
    expect(fetchMock.mock.calls[0][0]).toContain("/api/developer/v2/posts/");
    expect(r.data![0].sentiment).toBe("positive");
    expect(r.data![1].sentiment).toBe("negative");
  });
});
```

- [ ] **Step 2: 跑測試確認失敗** — Run: `npm test -- news` → FAIL。

- [ ] **Step 3: 實作**

`cryptosense/lib/tools/news.ts`:
```ts
import "server-only";
import { ok, fail, cachedFetch } from "./http";
import type { ToolResult } from "./types";

export type NewsItem = { title: string; url: string; publishedAt: string; sentiment: "positive" | "negative" | "neutral" };

function sentimentFromVotes(v: any): NewsItem["sentiment"] {
  const pos = v?.positive ?? 0, neg = v?.negative ?? 0;
  return pos > neg ? "positive" : neg > pos ? "negative" : "neutral";
}

export async function getCryptoNews(symbol?: string): Promise<ToolResult<NewsItem[]>> {
  try {
    const token = process.env.CRYPTOPANIC_TOKEN ?? "";
    const cur = symbol ? `&currencies=${encodeURIComponent(symbol)}` : "";
    // developer v2（依據：CryptoPanic 研究）
    const j = await cachedFetch(`https://cryptopanic.com/api/developer/v2/posts/?auth_token=${token}&public=true${cur}`, { ttlMs: 1_200_000 });
    const data: NewsItem[] = (j.results ?? []).slice(0, 8).map((p: any) => ({
      title: p.title, url: p.url, publishedAt: p.published_at, sentiment: sentimentFromVotes(p.votes),
    }));
    return ok(data, "CryptoPanic");
  } catch (e: any) { return fail("CryptoPanic", e.message); }
}
```

- [ ] **Step 4: 跑測試確認通過** — Run: `npm test -- news` → PASS。

- [ ] **Step 5: Commit**

```bash
git add cryptosense/lib/tools/news.ts cryptosense/lib/tools/news.test.ts
git commit -m "feat: crypto news tool (CryptoPanic developer v2)"
```

---

### Task 5: 資料 API routes（market + coin）

**Files:**
- Create: `cryptosense/app/api/market/route.ts`, `cryptosense/app/api/coin/[id]/route.ts`, `cryptosense/app/api/coin/[id]/route.test.ts`

**Interfaces:**
- Consumes: `lib/tools/market`, `lib/tools/coin`, `lib/tools/news`。
- Produces:
  - `GET /api/market` → `{ overview; fearGreed }`
  - `GET /api/coin/[id]` → `{ coin; news }`（無 technical）

- [ ] **Step 1: 寫失敗測試**

`cryptosense/app/api/coin/[id]/route.test.ts`:
```ts
// @vitest-environment node
import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/tools/coin", () => ({
  getCoinData: vi.fn().mockResolvedValue({ data: { id: "ethereum", symbol: "ETH", name: "Ethereum", price: 3540, change24h: -0.82, marketCap: 1, volume24h: 1, circulatingSupply: 1 }, source: "CoinGecko", timestamp: "t" }),
}));
vi.mock("@/lib/tools/news", () => ({ getCryptoNews: vi.fn().mockResolvedValue({ data: [], source: "CryptoPanic", timestamp: "t" }) }));

import { GET } from "./route";

describe("GET /api/coin/[id]", () => {
  it("returns coin/news bundle", async () => {
    const res = await GET(new Request("http://x/api/coin/ethereum"), { params: Promise.resolve({ id: "ethereum" }) });
    const body = await res.json();
    expect(body.coin.data.symbol).toBe("ETH");
    expect(body.news.data).toEqual([]);
  });
});
```

- [ ] **Step 2: 跑測試確認失敗** — Run: `npm test -- "coin/\[id\]"` → FAIL。

- [ ] **Step 3: 實作**

`cryptosense/app/api/market/route.ts`:
```ts
import { NextResponse } from "next/server";
import { getMarketOverview, getFearGreedIndex } from "@/lib/tools/market";

export async function GET() {
  const [overview, fearGreed] = await Promise.all([getMarketOverview(), getFearGreedIndex()]);
  return NextResponse.json({ overview, fearGreed });
}
```

`cryptosense/app/api/coin/[id]/route.ts`:
```ts
import { NextResponse } from "next/server";
import { getCoinData } from "@/lib/tools/coin";
import { getCryptoNews } from "@/lib/tools/news";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const coin = await getCoinData(id);
  const news = await getCryptoNews(coin.data?.symbol);
  return NextResponse.json({ coin, news });
}
```

- [ ] **Step 4: 跑測試確認通過** — Run: `npm test -- "coin/\[id\]"` → PASS。

- [ ] **Step 5: Commit**

```bash
git add cryptosense/app/api/market cryptosense/app/api/coin
git commit -m "feat: market and coin data API routes (coin+news, no technical)"
```

---

### Task 6: 市場總覽 Dashboard UI（KPI 版面）+ Recharts sparkline

**Files:**
- Create: `cryptosense/lib/format.ts`, `cryptosense/components/Sparkline.tsx`, `cryptosense/components/MarketDashboard.tsx`, `cryptosense/components/MarketDashboard.test.tsx`
- Modify: `cryptosense/app/page.tsx`

**Interfaces:**
- Consumes: `MarketOverview`, `FearGreed`。
- Produces: `MarketDashboard({ overview, fearGreed })`；`pct`, `usdCompact`, `changeClass` from `lib/format`；`Sparkline({ data, up })`（Recharts，client）。

- [ ] **Step 1: 寫失敗測試**

`cryptosense/components/MarketDashboard.test.tsx`:
```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MarketDashboard } from "./MarketDashboard";

const overview = { totalMarketCap: 3.42e12, totalVolume: 9.8e10, btcDominance: 54.3, coins: [
  { id: "bitcoin", symbol: "BTC", name: "Bitcoin", price: 67200, change24h: 1.2, marketCap: 1.3e12, spark7d: [1,2,3] },
  { id: "dogecoin", symbol: "DOGE", name: "Dogecoin", price: 0.12, change24h: -5.2, marketCap: 1e10, spark7d: [3,2,1] },
] };
const fg = { value: 52, label: "Neutral" };

describe("MarketDashboard", () => {
  it("shows KPI tiles + green/red by direction", () => {
    render(<MarketDashboard overview={overview} fearGreed={fg} />);
    expect(screen.getByText("52")).toBeInTheDocument();
    expect(screen.getByTestId("change-bitcoin").className).toMatch(/text-green/);
    expect(screen.getByTestId("change-dogecoin").className).toMatch(/text-red/);
  });
  it("links coin rows to detail page", () => {
    render(<MarketDashboard overview={overview} fearGreed={fg} />);
    expect(screen.getByRole("link", { name: /Bitcoin/ })).toHaveAttribute("href", "/coin/bitcoin");
  });
});
```

- [ ] **Step 2: 跑測試確認失敗** — Run: `npm test -- MarketDashboard` → FAIL。

- [ ] **Step 3: 實作 format + Sparkline**

`cryptosense/lib/format.ts`:
```ts
export const pct = (n: number) => `${n >= 0 ? "▲" : "▼"} ${Math.abs(n).toFixed(2)}%`;
export const usdCompact = (n: number) =>
  new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 2, style: "currency", currency: "USD" }).format(n);
export const changeClass = (n: number) => (n >= 0 ? "text-green-500" : "text-red-500");
```

`cryptosense/components/Sparkline.tsx`:
```tsx
"use client";
import { LineChart, Line, ResponsiveContainer } from "recharts";

export function Sparkline({ data, up }: { data: number[]; up: boolean }) {
  return (
    <ResponsiveContainer width="100%" height={32}>
      <LineChart data={data.map((v) => ({ v }))}>
        <Line type="monotone" dataKey="v" stroke={up ? "#22c55e" : "#ef4444"} dot={false} strokeWidth={1.5} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
```

- [ ] **Step 4: 實作 MarketDashboard**

`cryptosense/components/MarketDashboard.tsx`:
```tsx
import Link from "next/link";
import type { MarketOverview, FearGreed } from "@/lib/tools/market";
import { pct, usdCompact, changeClass } from "@/lib/format";
import { Sparkline } from "./Sparkline";

export function MarketDashboard({ overview, fearGreed }: { overview: MarketOverview; fearGreed: FearGreed }) {
  const sorted = [...overview.coins].sort((a, b) => b.change24h - a.change24h);
  const gainers = sorted.slice(0, 3), losers = sorted.slice(-3).reverse();
  const Tile = ({ label, value, sub, subClass = "" }: any) => (
    <div className="flex-1 rounded-lg border border-slate-800 bg-slate-900 p-3">
      <div className="text-[10px] uppercase tracking-wide text-slate-400">{label}</div>
      <div className="text-2xl font-bold text-white">{value}</div>
      <div className={`text-sm ${subClass}`}>{sub}</div>
    </div>
  );
  return (
    <div className="space-y-3">
      <div className="flex gap-3">
        <Tile label="恐懼貪婪" value={fearGreed.value} sub={`😐 ${fearGreed.label}`} subClass="text-amber-400" />
        <Tile label="總市值" value={usdCompact(overview.totalMarketCap)} />
        <Tile label="24h 量" value={usdCompact(overview.totalVolume)} />
        <Tile label="BTC 主導" value={`${overview.btcDominance.toFixed(1)}%`} />
      </div>
      <div className="flex gap-3">
        <div className="flex-1 rounded-lg border border-slate-800 bg-slate-900 p-3">
          <div className="text-xs font-medium text-green-500">▲ 漲幅榜</div>
          {gainers.map((c) => <span key={c.id} className="mr-2">{c.symbol} <span className={changeClass(c.change24h)}>{pct(c.change24h)}</span></span>)}
        </div>
        <div className="flex-1 rounded-lg border border-slate-800 bg-slate-900 p-3">
          <div className="text-xs font-medium text-red-500">▼ 跌幅榜</div>
          {losers.map((c) => <span key={c.id} className="mr-2">{c.symbol} <span className={changeClass(c.change24h)}>{pct(c.change24h)}</span></span>)}
        </div>
      </div>
      <div className="rounded-lg border border-slate-800 bg-slate-900 p-3">
        <div className="mb-2 text-[10px] uppercase tracking-wide text-slate-400">市值排行</div>
        <table className="w-full text-sm">
          <thead><tr className="text-left text-slate-400"><th>#</th><th>幣</th><th>價格</th><th>24h</th><th>7d</th></tr></thead>
          <tbody>
            {overview.coins.map((c, i) => (
              <tr key={c.id} className="border-t border-slate-800">
                <td>{i + 1}</td>
                <td><Link className="text-sky-400 hover:underline" href={`/coin/${c.id}`}>{c.name}</Link></td>
                <td>${c.price.toLocaleString()}</td>
                <td data-testid={`change-${c.id}`} className={changeClass(c.change24h)}>{pct(c.change24h)}</td>
                <td className="w-24">{c.spark7d.length > 1 && <Sparkline data={c.spark7d} up={c.change24h >= 0} />}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: 接首頁（Server Component）**

`cryptosense/app/page.tsx`:
```tsx
import { MarketDashboard } from "@/components/MarketDashboard";
import { getMarketOverview, getFearGreedIndex } from "@/lib/tools/market";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [overview, fearGreed] = await Promise.all([getMarketOverview(), getFearGreedIndex()]);
  return (
    <main className="mx-auto max-w-5xl p-6">
      <h1 className="mb-4 text-xl font-bold text-white">CryptoSense · 市場總覽</h1>
      {overview.data && fearGreed.data
        ? <MarketDashboard overview={overview.data} fearGreed={fearGreed.data} />
        : <p className="text-slate-400">市場資料暫時取不到，請稍後再試。</p>}
    </main>
  );
}
```

- [ ] **Step 6: 跑測試 + 手動驗證** — Run: `npm test -- MarketDashboard` → PASS；`npm run dev` 確認儀表板、綠漲紅跌、sparkline、點幣連到 /coin/[id]。

- [ ] **Step 7: Commit**

```bash
git add cryptosense/lib/format.ts cryptosense/components/Sparkline.tsx cryptosense/components/MarketDashboard.tsx cryptosense/components/MarketDashboard.test.tsx cryptosense/app/page.tsx
git commit -m "feat: market dashboard (KPI layout) with sparklines"
```

---

### Task 7: 精簡個幣分析頁 UI（行情 + 新聞 + AI CTA，無圖表/技術面）

**Files:**
- Create: `cryptosense/components/CoinDetail.tsx`, `cryptosense/components/CoinDetail.test.tsx`, `cryptosense/app/coin/[id]/page.tsx`

**Interfaces:**
- Consumes: `CoinData`, `NewsItem`；`changeClass`, `pct`。
- Produces: `CoinDetail({ coin, news, updatedAt })`。

- [ ] **Step 1: 寫失敗測試**

`cryptosense/components/CoinDetail.test.tsx`:
```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CoinDetail } from "./CoinDetail";

const coin = { id: "ethereum", symbol: "ETH", name: "Ethereum", price: 3540.18, change24h: -0.82, marketCap: 1, volume24h: 1, circulatingSupply: 1 };
const news = [{ title: "ETF approved", url: "http://a", publishedAt: "2026-06-18T00:00:00Z", sentiment: "positive" as const }];

describe("CoinDetail", () => {
  it("renders header, news, and AI CTA", () => {
    render(<CoinDetail coin={coin} news={news} updatedAt="2026-06-19 14:32" />);
    expect(screen.getByText(/Ethereum/)).toBeInTheDocument();
    expect(screen.getByText(/ETF approved/)).toBeInTheDocument();
    expect(screen.getByText(/我現在該進場/)).toBeInTheDocument();
  });
  it("shows empty-news note when no news", () => {
    render(<CoinDetail coin={coin} news={[]} updatedAt="t" />);
    expect(screen.getByText(/近期無新聞/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 跑測試確認失敗** — Run: `npm test -- CoinDetail` → FAIL。

- [ ] **Step 3: 實作 CoinDetail**

`cryptosense/components/CoinDetail.tsx`:
```tsx
import Link from "next/link";
import type { CoinData } from "@/lib/tools/coin";
import type { NewsItem } from "@/lib/tools/news";
import { pct, changeClass, usdCompact } from "@/lib/format";

const sent: Record<string, string> = { positive: "利多", negative: "利空", neutral: "中性" };
const sentClass = (s: string) => (s === "negative" ? "text-red-500" : s === "positive" ? "text-green-500" : "text-slate-400");

export function CoinDetail({ coin, news, updatedAt }: { coin: CoinData; news: NewsItem[]; updatedAt: string }) {
  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-wide text-slate-400">{coin.name} · {coin.symbol}</div>
          <div className="text-3xl font-bold text-white">${coin.price.toLocaleString()}{" "}
            <span className={`text-sm ${changeClass(coin.change24h)}`}>{pct(coin.change24h)} (24h)</span></div>
        </div>
        <div className="text-right text-xs text-slate-400">資料更新<br />{updatedAt}</div>
      </div>

      <div className="flex gap-3 text-sm text-slate-300">
        <div>市值 <span className="text-white">{usdCompact(coin.marketCap)}</span></div>
        <div>24h 量 <span className="text-white">{usdCompact(coin.volume24h)}</span></div>
      </div>

      <section className="rounded-lg border border-slate-800 bg-slate-900 p-3">
        <h2 className="mb-2 font-semibold text-white">📰 新聞與情緒</h2>
        {news.length ? news.map((n, i) => (
          <div key={i} className="border-t border-slate-800 py-1 text-sm">
            <a className="text-sky-400 hover:underline" href={n.url} target="_blank" rel="noopener noreferrer">{n.title}</a>{" "}
            <span data-testid={`news-sentiment-${i}`} className={sentClass(n.sentiment)}>{sent[n.sentiment]}</span>
          </div>
        )) : <p className="text-slate-400">近期無新聞。</p>}
        <div className="mt-1 text-[10px] text-sky-400">來源：CryptoPanic · {updatedAt}</div>
      </section>

      <Link href={`/coin/${coin.id}?chat=1`} className="block w-full rounded-lg bg-blue-600 py-3 text-center font-semibold text-white">
        💬 針對 {coin.symbol} 問 AI：「我現在該進場嗎？」</Link>
    </div>
  );
}
```

- [ ] **Step 4: 實作頁面（含 Chat 佔位，Task 10 接上）**

`cryptosense/app/coin/[id]/page.tsx`:
```tsx
import { CoinDetail } from "@/components/CoinDetail";
import { getCoinData } from "@/lib/tools/coin";
import { getCryptoNews } from "@/lib/tools/news";

export const dynamic = "force-dynamic";

export default async function CoinPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const coin = await getCoinData(id);
  const news = coin.data ? (await getCryptoNews(coin.data.symbol)).data ?? [] : [];
  return (
    <main className="mx-auto max-w-3xl p-6">
      {coin.data
        ? <CoinDetail coin={coin.data} news={news} updatedAt={new Date(coin.timestamp).toLocaleString()} />
        : <p className="text-slate-400">找不到此幣資料。</p>}
    </main>
  );
}
```

- [ ] **Step 5: 跑測試 + 手動驗證** — Run: `npm test -- CoinDetail` → PASS；`npm run dev` 進 /coin/ethereum 確認行情、新聞、CTA。

- [ ] **Step 6: Commit**

```bash
git add cryptosense/components/CoinDetail.tsx cryptosense/components/CoinDetail.test.tsx cryptosense/app/coin/[id]/page.tsx
git commit -m "feat: slim coin detail page (price + news + AI CTA)"
```

---

### Task 8: 個人知識庫 RAG（OpenAI File Search）

> 依「先把 RAG 建構出來」，此 task 排在 AI 問答之前。RAG 用 OpenAI hosted 向量庫，不自建。

**Files:**
- Create: `cryptosense/lib/rag/fileSearch.ts`, `cryptosense/lib/rag/fileSearch.test.ts`, `cryptosense/scripts/ingest.ts`, `cryptosense/knowledge/.gitkeep`

**Interfaces:**
- Consumes: `openai` SDK；`ok`/`fail`。
- Produces:
  - `type KbChunk = { text: string; source: string }`
  - `function searchKnowledgeBase(query: string, client?): Promise<ToolResult<KbChunk[]>>` — 查 `OPENAI_VECTOR_STORE_ID` 的向量庫，回帶來源的片段；client 可注入（測試用）。
  - `scripts/ingest.ts` — 離線把 `knowledge/` 內的文字檔上傳並建立向量庫，印出 `OPENAI_VECTOR_STORE_ID`。

- [ ] **Step 1: 確認 OpenAI SDK 的 vector store / File Search API 名稱**

Run（Task 0 安裝後）: `cd cryptosense && node -e "const o=require('openai');console.log(Object.keys(new o.default({apiKey:'x'})).filter(k=>k.includes('ector')||k==='files'))"`
Expected: 看到 `vectorStores`（或對應命名）。**以實際匯出為準**回填下方方法名（API 隨 SDK 版本可能微調）。

- [ ] **Step 2: 寫失敗測試**

`cryptosense/lib/rag/fileSearch.test.ts`:
```ts
// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import { searchKnowledgeBase } from "./fileSearch";

describe("searchKnowledgeBase", () => {
  it("maps vector store search results to chunks with source", async () => {
    process.env.OPENAI_VECTOR_STORE_ID = "vs_1";
    const client = { vectorStores: { search: vi.fn().mockResolvedValue({ data: [
      { filename: "notes.md", content: [{ text: "ETH 解鎖事件" }] },
    ] }) } };
    const r = await searchKnowledgeBase("ETH 風險", client as any);
    expect(r.source).toBe("KnowledgeBase");
    expect(r.data![0]).toEqual({ text: "ETH 解鎖事件", source: "notes.md" });
  });
  it("returns error when vector store id missing", async () => {
    delete process.env.OPENAI_VECTOR_STORE_ID;
    const r = await searchKnowledgeBase("x", { vectorStores: { search: vi.fn() } } as any);
    expect(r.error).toMatch(/not configured/);
  });
});
```

- [ ] **Step 3: 跑測試確認失敗** — Run: `npm test -- fileSearch` → FAIL。

- [ ] **Step 4: 實作**

`cryptosense/lib/rag/fileSearch.ts`:
```ts
import "server-only";
import OpenAI from "openai";
import { ok, fail } from "@/lib/tools/http";
import type { ToolResult } from "@/lib/tools/types";

const defaultClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
export type KbChunk = { text: string; source: string };

export async function searchKnowledgeBase(query: string, client: any = defaultClient): Promise<ToolResult<KbChunk[]>> {
  const vsId = process.env.OPENAI_VECTOR_STORE_ID;
  if (!vsId) return fail("KnowledgeBase", "vector store not configured");
  try {
    const res = await client.vectorStores.search(vsId, { query, max_num_results: 5 });
    const chunks: KbChunk[] = (res.data ?? []).map((r: any) => ({
      text: (r.content ?? []).map((c: any) => c.text).join("\n"),
      source: r.filename ?? r.file_id ?? "knowledge-base",
    }));
    return ok(chunks, "KnowledgeBase");
  } catch (e: any) { return fail("KnowledgeBase", e.message); }
}
```

- [ ] **Step 5: 跑測試確認通過** — Run: `npm test -- fileSearch` → PASS。

- [ ] **Step 6: 寫 ingest 腳本**

`cryptosense/scripts/ingest.ts`（離線執行；方法名以 Step 1 確認為準）:
```ts
import OpenAI from "openai";
import fs from "node:fs";
import path from "node:path";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function main() {
  const dir = process.argv[2] ?? "./knowledge";
  const vs = await client.vectorStores.create({ name: "cryptosense-kb" });
  const files = fs.readdirSync(dir).filter((f) => !f.startsWith(".")).map((f) => fs.createReadStream(path.join(dir, f)));
  if (files.length) await client.vectorStores.fileBatches.uploadAndPoll(vs.id, { files });
  console.log("OPENAI_VECTOR_STORE_ID=" + vs.id);
}
main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 7: 手動驗證 ingest + 設定 env**

把幾個文字檔放進 `cryptosense/knowledge/`，Run: `npx tsx scripts/ingest.ts ./knowledge`。把印出的 `OPENAI_VECTOR_STORE_ID` 填進 `.env.local`。
正確完成判準：`searchKnowledgeBase("...")` 在 dev 環境能回傳相關片段＋來源檔名。

- [ ] **Step 8: Commit**

```bash
git add cryptosense/lib/rag cryptosense/scripts/ingest.ts cryptosense/knowledge/.gitkeep
git commit -m "feat: knowledge base RAG via OpenAI File Search"
```

---

### Task 9: AI 問答後端（AI SDK streamText + 3 工具）

**Files:**
- Create: `cryptosense/lib/ai/prompt.ts`, `cryptosense/lib/ai/tools.ts`, `cryptosense/lib/ai/tools.test.ts`, `cryptosense/lib/ai/chat.ts`, `cryptosense/lib/ai/chat.test.ts`, `cryptosense/app/api/chat/route.ts`

**Interfaces:**
- Consumes: `lib/tools/coin`、`lib/tools/news`、`lib/rag/fileSearch`；`ai`、`@ai-sdk/openai`、`zod`。
- Produces:
  - `const SYSTEM_PROMPT: string`
  - `const cryptoTools` — **剛好 3 支**：`{ getCoinData, getCryptoNews, searchKnowledgeBase }`（各為 `tool()`）。
  - `function runChat(opts: { messages; coinId?; model? }): ReturnType<typeof streamText>` — model 可注入。**P1 不寫 DB。**
  - `POST /api/chat` → `runChat(...).toUIMessageStreamResponse()`。

- [ ] **Step 1: 寫失敗測試（工具 + chat 串流）**

`cryptosense/lib/ai/tools.test.ts`:
```ts
// @vitest-environment node
import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/tools/coin", () => ({
  getCoinData: vi.fn().mockResolvedValue({ data: { symbol: "ETH" }, source: "CoinGecko", timestamp: "t" }),
}));
vi.mock("@/lib/tools/news", () => ({ getCryptoNews: vi.fn().mockResolvedValue({ data: [], source: "CryptoPanic", timestamp: "t" }) }));
vi.mock("@/lib/rag/fileSearch", () => ({ searchKnowledgeBase: vi.fn().mockResolvedValue({ data: [{ text: "x", source: "n.md" }], source: "KnowledgeBase", timestamp: "t" }) }));

import { cryptoTools } from "./tools";

describe("cryptoTools", () => {
  it("exposes exactly 3 tools", () => {
    expect(Object.keys(cryptoTools).sort()).toEqual(["getCoinData", "getCryptoNews", "searchKnowledgeBase"]);
  });
  it("getCoinData.execute returns ToolResult", async () => {
    const r = await (cryptoTools.getCoinData as any).execute({ id: "ethereum" });
    expect(r.data.symbol).toBe("ETH");
  });
  it("searchKnowledgeBase.execute returns chunks", async () => {
    const r = await (cryptoTools.searchKnowledgeBase as any).execute({ query: "ETH 風險" });
    expect(r.data[0].source).toBe("n.md");
  });
});
```

`cryptosense/lib/ai/chat.test.ts`:
```ts
// @vitest-environment node
import { describe, it, expect } from "vitest";
import { MockLanguageModelV2, simulateReadableStream } from "ai/test";
import { runChat } from "./chat";

describe("runChat", () => {
  it("streams text from injected model", async () => {
    const model = new MockLanguageModelV2({
      doStream: async () => ({
        stream: simulateReadableStream({ chunks: [
          { type: "text-start", id: "t1" },
          { type: "text-delta", id: "t1", delta: "中高風險" },
          { type: "text-end", id: "t1" },
          { type: "finish", finishReason: "stop", usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
        ] }),
      }),
    });
    const result = runChat({ messages: [{ role: "user", parts: [{ type: "text", text: "ETH?" }] }], model });
    let text = "";
    for await (const part of result.textStream) text += part;
    expect(text).toContain("中高風險");
  });
});
```
> 註：`ai/test` 的 Mock 類別名稱依安裝的 `ai` 版本而定（v5 對應 `MockLanguageModelV2`；若版本不同改用對應類別）。實作時以 `import` 實際匯出為準。

- [ ] **Step 2: 跑測試確認失敗** — Run: `npm test -- "ai/"` → FAIL。

- [ ] **Step 3: 實作 prompt + tools**

`cryptosense/lib/ai/prompt.ts`:
```ts
export const SYSTEM_PROMPT = `你是 CryptoSense，加密貨幣「投資前風險研究」助手。
能力：用 3 個工具——getCoinData(即時行情)、getCryptoNews(近期新聞情緒)、searchKnowledgeBase(使用者個人知識庫)——協助使用者了解風險與盲點。
規則：
1. 不報明牌、不保證獲利、不給明確「買/賣」指令；用「正面觀點 vs 風險/盲點」呈現，由使用者自行判斷。
2. 所有數字只能來自工具回傳，絕不可自行編造或憑記憶；需要數據時呼叫工具。
3. 每個判斷標註資料來源與時間（用工具回傳的 source/timestamp）。
4. 信心用高/中/低，不用假精確百分比。
5. 先給結論（風險定調），再分「✅ 正面觀點」「⚠️ 風險/盲點」「📰 新聞情緒」。
6. 結尾固定附免責：「本內容為 AI 整理之公開資訊，非投資建議，請自行查證評估風險。」
7. 工具回傳 error 時誠實說明該項資料暫時取不到，不要編造。
8. 來自 searchKnowledgeBase 的內容用 📚 標示，與公開資料來源區隔。`;
```

`cryptosense/lib/ai/tools.ts`（剛好 3 支：即時行情 / 新聞 / 知識庫）:
```ts
import { tool } from "ai";
import { z } from "zod";
import { getCoinData } from "@/lib/tools/coin";
import { getCryptoNews } from "@/lib/tools/news";
import { searchKnowledgeBase } from "@/lib/rag/fileSearch";

export const cryptoTools = {
  getCoinData: tool({
    description: "取得某幣的即時行情（價格、24h 漲跌、市值、成交量、流通量）",
    inputSchema: z.object({ id: z.string().describe("CoinGecko id, 如 ethereum") }),
    execute: async ({ id }) => getCoinData(id),
  }),
  getCryptoNews: tool({
    description: "取得某幣近期新聞與情緒（利多/利空/中性）",
    inputSchema: z.object({ symbol: z.string().describe("幣符號如 ETH") }),
    execute: async ({ symbol }) => getCryptoNews(symbol),
  }),
  searchKnowledgeBase: tool({
    description: "檢索使用者的個人知識庫（自有筆記/對話），回傳帶來源的片段",
    inputSchema: z.object({ query: z.string() }),
    execute: async ({ query }) => searchKnowledgeBase(query),
  }),
};
```

- [ ] **Step 4: 實作 chat（model 可注入，無 DB）**

`cryptosense/lib/ai/chat.ts`:
```ts
import { streamText, stepCountIs, convertToModelMessages, type LanguageModel, type UIMessage } from "ai";
import { openai } from "@ai-sdk/openai";
import { SYSTEM_PROMPT } from "./prompt";
import { cryptoTools } from "./tools";

export function runChat({ messages, coinId, model }: { messages: UIMessage[]; coinId?: string; model?: LanguageModel }) {
  const system = coinId ? `${SYSTEM_PROMPT}\n\n目前使用者正在看的幣 id：${coinId}` : SYSTEM_PROMPT;
  return streamText({
    model: model ?? openai("gpt-4o"),
    system,
    messages: convertToModelMessages(messages),
    tools: cryptoTools,
    stopWhen: stepCountIs(6),
  });
}
```

- [ ] **Step 5: 實作 route**

`cryptosense/app/api/chat/route.ts`:
```ts
import { runChat } from "@/lib/ai/chat";

export const maxDuration = 30;

export async function POST(req: Request) {
  const { messages, coinId } = await req.json();
  const result = runChat({ messages, coinId });
  return result.toUIMessageStreamResponse({ onError: () => "分析時發生錯誤，請稍後再試。" });
}
```

- [ ] **Step 6: 跑測試確認通過** — Run: `npm test -- "ai/"` → PASS。

- [ ] **Step 7: Commit**

```bash
git add cryptosense/lib/ai cryptosense/app/api/chat
git commit -m "feat: AI chat backend (exactly 3 tools: coin/news/knowledge, no DB)"
```

---

### Task 10: AI 問答前端（useChat + markdown + chips + 工具步驟顯示）

**Files:**
- Create: `cryptosense/components/Chat.tsx`, `cryptosense/components/Chat.test.tsx`
- Modify: `cryptosense/app/coin/[id]/page.tsx`（CoinDetail 後加入 Chat）

**Interfaces:**
- Consumes: `POST /api/chat`；`@ai-sdk/react` `useChat`、`DefaultChatTransport`、`react-markdown`、`remark-gfm`。
- Produces: `Chat({ coinId, symbol })`（client）；渲染 AI 回答 markdown、情境化 chips，並在串流中顯示工具步驟（`tool-*` parts）。**P1 無 👍/👎（需 DB，P2）。**

- [ ] **Step 1: 寫失敗測試**

`cryptosense/components/Chat.test.tsx`:
```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// 隔離 useChat，只測本元件的靜態 UI（能力框/免責/chips）
vi.mock("@ai-sdk/react", () => ({ useChat: () => ({ messages: [], sendMessage: vi.fn(), status: "ready", stop: vi.fn() }) }));
import { Chat } from "./Chat";

describe("Chat", () => {
  it("frames capability + disclaimer, not 'ask me anything'", () => {
    render(<Chat coinId="ethereum" symbol="ETH" />);
    expect(screen.getByText(/風險面、近期新聞與個人知識/)).toBeInTheDocument();
    expect(screen.getByText(/非投資建議/)).toBeInTheDocument();
    expect(screen.queryByText(/問我任何事/)).toBeNull();
  });
  it("renders contextual chips for the symbol", () => {
    render(<Chat coinId="ethereum" symbol="ETH" />);
    expect(screen.getByRole("button", { name: /ETH 主要下行風險/ })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 跑測試確認失敗** — Run: `npm test -- Chat` → FAIL。

- [ ] **Step 3: 實作 Chat**

`cryptosense/components/Chat.tsx`:
```tsx
"use client";
import { useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

// 工具名 → 串流步驟中文標籤
const TOOL_LABEL: Record<string, string> = {
  getCoinData: "取得行情",
  getCryptoNews: "檢索新聞",
  searchKnowledgeBase: "查知識庫",
};

export function Chat({ coinId, symbol }: { coinId: string; symbol: string }) {
  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat", body: { coinId } }),
  });
  const [input, setInput] = useState("");
  const chips = [`${symbol} 主要下行風險？`, `跟 BTC 比較`, `最新利空新聞`];
  const busy = status !== "ready";

  const submit = (text: string) => { if (text.trim() && !busy) { sendMessage({ text }); setInput(""); } };

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900">
      <div className="flex justify-between border-b border-slate-800 p-2 text-xs text-slate-400">
        <span>💬 AI 研究助手 · 情境：{symbol}</span><span>🤖 AI 生成，非投資建議</span>
      </div>
      <div className="space-y-2 p-3 text-sm" aria-live="polite">
        <div className="rounded border border-slate-700 bg-slate-800 p-2 text-xs">
          👋 我可以幫你了解 <b>{symbol} 的風險面、近期新聞與個人知識整合分析</b>，我不會報明牌或保證獲利。</div>
        {messages.map((m) => (
          <div key={m.id} className={m.role === "user" ? "text-right" : ""}>
            {m.role === "user"
              ? <span className="inline-block rounded bg-blue-600 px-2 py-1 text-white">{m.parts.map((p: any) => p.type === "text" ? p.text : "").join("")}</span>
              : <div className="prose prose-invert max-w-none text-slate-200">
                  {/* 工具步驟：把 tool-* parts 渲染成步驟徽章 */}
                  {m.parts.filter((p: any) => typeof p.type === "string" && p.type.startsWith("tool-")).length > 0 && (
                    <div className="mb-1 flex flex-wrap gap-1 text-[10px]">
                      {m.parts.filter((p: any) => typeof p.type === "string" && p.type.startsWith("tool-")).map((p: any, i: number) => {
                        const name = p.type.replace("tool-", "");
                        const done = p.state === "output-available" || p.state === "output-error";
                        return <span key={i} className={`rounded-full px-2 py-0.5 ${done ? "bg-slate-700 text-slate-300" : "bg-amber-900/40 text-amber-300"}`}>
                          {done ? "✓" : "⏳"} {TOOL_LABEL[name] ?? name}</span>;
                      })}
                    </div>
                  )}
                  {m.parts.map((p: any, i: number) => p.type === "text"
                    ? <Markdown key={i} remarkPlugins={[remarkGfm]} components={{ a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer">{children}</a> }}>{p.text}</Markdown>
                    : null)}
                </div>}
          </div>
        ))}
        {status === "submitted" && <div className="text-xs text-slate-400">彙整中…</div>}
        <div className="flex flex-wrap gap-2">
          {chips.map((c) => <button key={c} disabled={busy} onClick={() => submit(c)} className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-200 disabled:opacity-50">{c}</button>)}
        </div>
      </div>
      <div className="flex gap-2 border-t border-slate-800 p-2">
        <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit(input)}
          placeholder={`繼續問關於 ${symbol} 的問題…`} className="flex-1 rounded bg-slate-950 px-2 py-2 text-slate-200" />
        <button onClick={() => submit(input)} disabled={busy} className="rounded bg-blue-600 px-4 font-semibold text-white disabled:opacity-50">送出</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: 把 Chat 加到個幣頁**

在 `cryptosense/app/coin/[id]/page.tsx` 的 `coin.data` 分支內、CoinDetail 之後加：
```tsx
import { Chat } from "@/components/Chat";
// ...CoinDetail 之後：
{coin.data && <div className="mt-6"><Chat coinId={coin.data.id} symbol={coin.data.symbol} /></div>}
```

- [ ] **Step 5: 跑測試 + 端到端手動驗證** — Run: `npm test` → 全綠；設 `.env.local` 的 `OPENAI_API_KEY`，`npm run dev`，進 /coin/ethereum 問「我現在該進場嗎？」→ 確認串流 markdown 回答、工具步驟徽章、正反觀點、結尾免責、chips 可用。

- [ ] **Step 6: Commit**

```bash
git add cryptosense/components/Chat.tsx cryptosense/components/Chat.test.tsx cryptosense/app/coin/[id]/page.tsx
git commit -m "feat: AI chat UI (useChat + markdown + chips + tool-step badges)"
```

---

### Task 11: 部署到 Railway（僅 Web Service，無 Postgres）

**Files:**
- Create / 確認: `cryptosense/.env.local.example`、`cryptosense/README.md`。多數情況 Railway 可自動偵測 Next.js，免設定檔。

**Interfaces:**
- Produces: 可公開存取的 Railway 部署網址，對齊 spec §5「可部署到 Railway 並正常操作」。

- [ ] **Step 1: 確認 production build 可過**

Run: `cd cryptosense && npm run build`
Expected: build 成功（無型別/lint 阻斷錯誤）。若失敗先修。

- [ ] **Step 2: 確認 start 指令與埠**

確認 `package.json` 的 `start` 為 `next start`；Railway 會注入 `PORT`，Next.js `next start` 預設讀 `PORT`，無需改動。

- [ ] **Step 3: 用 Railway 建立 service**

使用 railway skill（`use-railway`）或 Railway MCP/CLI：建立專案、加入此 app service（root 設 `cryptosense/`）。**P1 不掛 Postgres。**
（CLI 對應：`railway init` → `railway up`。）

- [ ] **Step 4: 設定環境變數**

在 Railway 專案變數加入：`OPENAI_API_KEY`、`COINGECKO_DEMO_KEY`、`CRYPTOPANIC_TOKEN`、`OPENAI_VECTOR_STORE_ID`（Task 8 ingest 產生）。

- [ ] **Step 5: 產生公開網址並驗證**

在 Railway 產生 public domain；開啟網址，手動驗證：市場總覽載入 → 點幣進個幣頁 → AI 問答可串流回答（含工具步驟、知識庫引用、正反觀點、免責）。
正確完成判準：上述流程全通，且資料取不到時 graceful（不崩潰不編造）。

- [ ] **Step 6: 記錄網址**

把公開網址記到 `cryptosense/README.md`（建立或更新），方便作品集展示。

```bash
git add cryptosense/README.md
git commit -m "docs: record Railway deployment URL"
```

---

## 工時估算與正確完成判準

> 估時為單一開發者粗估（含寫測試）；「正確完成判準」是給 AI 執行者的驗收依據。

| Task | 內容 | 估時 | 正確完成判準 |
|------|------|------|------------|
| 0 | Scaffold + Vitest | 1.5h | `npm test` 跑得起來（冒煙 1 passed）、`npm run dev` 起站 |
| 1 | 型別 + cachedFetch（stale fallback） | 1.5h | http.test 全綠（含 stale fallback、無快取時 throw） |
| 2 | 市場總覽 + F&G 工具 | 1.5h | market.test 全綠；F&G value 轉 number；失敗回 error |
| 3 | 個幣資料工具 | 0.5h | coin.test 全綠；失敗回 error |
| 4 | 新聞工具（CryptoPanic v2） | 1h | news.test 全綠；URL 含 `/api/developer/v2/posts/` |
| 5 | 資料 API routes | 1h | coin route.test 綠；回傳 `{coin,news}` 結構正確 |
| 6 | 市場 Dashboard UI + sparkline | 2.5h | MarketDashboard.test 綠；綠漲紅跌；點幣可連 detail |
| 7 | 精簡個幣頁（行情+新聞+CTA） | 1.5h | CoinDetail.test 綠；無新聞顯示提示 |
| 8 | RAG（File Search）+ ingest | 3h | fileSearch.test 綠；dev 能檢索到知識庫片段＋來源 |
| 9 | AI 問答後端（3 工具） | 2h | ai 測試綠（剛好 3 工具名、execute 回 ToolResult、串流文字） |
| 10 | AI 問答前端（useChat + markdown + 工具步驟） | 2.5h | Chat.test 綠；端到端串流回答含免責、工具步驟徽章 |
| 11 | 部署 Railway（Web Service） | 1.5h | 公開網址可操作；全流程不崩潰不編造 |
| **合計** | | **~20.5h** | （約 3 個工作天，單人） |

## P1 完成定義（DoD）

- `npm test` 全綠（http/market/coin/news/route/MarketDashboard/CoinDetail/fileSearch/AI/Chat）。
- `npm run dev` 可操作：市場總覽（KPI 版面 + sparkline）→ 點幣 → 精簡個幣頁（行情 + 新聞）→ AI 串流問答（含 3 工具步驟、知識庫引用、正反觀點、免責）。
- 對齊 spec §5 可驗證成功條件；綠漲紅跌全站一致；資料取不到時 graceful（stale fallback / 友善訊息），不崩潰不編造。
- 成功部署到 Railway（僅 Web Service），公開網址可正常操作（Task 11）。

## 後續計畫（不在本計畫，見 spec §6）

- **P2（差異化亮點）**：風險彙整卡（結構化 positives/risks/confidence/verdict）、個幣頁技術面（getOHLCV + calcTechnicalSignals + K 線圖）、新增 4 支工具、Railway PostgreSQL + Drizzle ORM（chat_sessions/messages + risk_assessments/risk_points）、👍/👎 回饋。
- **P3（有深度）**：細緻歷史快照（technical_signals/sentiment_snapshots/onchain_snapshots）、工具追蹤（tool_executions）、各式快取。
- **P4（有數據）**：GA4 埋點（6 事件 + 4 維度）+ 漏斗/趨勢探索報表（量測北極星指標）、Upstash Redis。

---

## Self-Review

- **Spec coverage**：F1 市場總覽(Task 2,6)、F2 精簡個幣頁(Task 3,4,5,7)、F3 AI 問答 3 工具+串流+工具步驟(Task 9,10)、F4 知識庫 RAG(Task 8)、graceful/不編造(http stale fallback + 各工具 + UI)、綠漲紅跌/來源時間戳、能力界定/免責(prompt + Chat)、Railway 部署(Task 11)。記憶體快取通用條件由 Task 1 cachedFetch 滿足。
- **依 feedback 後移**：技術面/K 線圖、風險彙整卡、DB、👍/👎、GA4 全部不在 P1（見「與 v2.1 差異」表與 spec §6）。
- **Placeholder scan**：無 TBD/TODO；每步附完整程式碼。版本敏感處明確標「以實際匯出為準」並附驗證步驟：`ai/test` Mock 類別名（Task 9）、OpenAI vector store API 名（Task 8 Step 1）。
- **Type consistency**：`ToolResult<T>` 貫穿；`cryptoTools` 剛好 3 工具名（getCoinData/getCryptoNews/searchKnowledgeBase）與測試一致；`runChat` 的 `coinId`/`model` 與 route/測試對齊；元件 props（CoinDetail 無 technical/candles）與工具回傳型別一致。
- **已知覆蓋缺口**：Task 10 前端測試 mock 掉 `useChat`，只驗證靜態 UI（能力框/免責/chips）；串流與工具步驟徽章的實際行為靠 Task 9 後端測試 + 端到端手動驗證涵蓋。
