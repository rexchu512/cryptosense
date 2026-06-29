> ⚠️ **已被取代（SUPERSEDED）**：本版（v2.1）把 DB/Postgres、技術面、👍/👎 都放在 P1。依 `2026-06-20-spec-feedback.md` 重新分期後，P1 已最小化，這些功能後移到 P2+。**現行計畫請見 [2026-06-21-cryptosense-p1-mvp-plan.md](2026-06-21-cryptosense-p1-mvp-plan.md)。** 本檔保留作為 P2 的參考素材（DB schema、技術指標、query_logs 等實作仍可沿用）。

---

# CryptoSense P1 (核心 MVP) Implementation Plan — v2.1（納入 File Search RAG + 產品數據紀錄）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 做出可 demo 的加密貨幣 AI 研究助手「產品」MVP：市場總覽 Dashboard、個幣分析頁（行情/技術/新聞/圖表）、情境感知 AI 問答（**3 支工具** + 串流）、**個人知識庫（OpenAI File Search RAG）**、**產品使用數據紀錄（Railway Postgres：query_logs / feedback）**，對應 spec 的 F1–F5。

**Architecture:** 單一 Next.js (App Router) repo。資料工具（CoinGecko / Alternative.me / CryptoPanic）為純函式，回傳一律帶 `source`/`timestamp`，並有快取與 stale fallback；技術指標本地計算。AI 問答用 **Vercel AI SDK v5** 的 `streamText` + `tool()`（**精簡為 3 支工具**：個幣綜合 / 市場總覽 / 知識庫檢索）+ 多步工具迴圈，前端用 `useChat`。RAG 用 **OpenAI File Search**（hosted 向量庫＋檢索，不自建）。每次問答與按讚回饋寫入 **Railway Postgres**，作為「使用者是否感受到價值」的行為指標來源。

**Tech Stack:** Next.js 15+ (App Router) · TypeScript · Tailwind · Vitest + @testing-library/react + vite-tsconfig-paths · Vercel AI SDK v5 (`ai`, `@ai-sdk/openai`, `@ai-sdk/react`) · **OpenAI File Search（RAG）** · `technicalindicators` · `lightweight-charts` v5 · `recharts` · `react-markdown` + `remark-gfm` · **Railway Postgres + `postgres` (driver)**。

## 技術選型與依據（每個選型都附研究來源）

| 選型 | 依據（來自 Context7 研究） |
|------|---------------------------|
| **Vercel AI SDK v5（非原生 OpenAI SDK）** | 兩個獨立研究 agent 一致建議：本專案核心需求（多資料工具串接、串流合成答案、Next.js 前端渲染）AI SDK 全內建；原生 SDK 須手寫工具迴圈、SSE 串流、tool_calls 分片拼接、等效 `useChat`，投報率低。來源：Vercel AI SDK v5 官方文件 `chatbot-tool-usage.mdx`、`call-tools-multiple-steps.mdx`。 |
| **`streamText` + `stopWhen: stepCountIs(n)`** | v5 內建多步工具迴圈，設步數上限防失控。來源：`call-tools-multiple-steps.mdx`、agents.mdx。 |
| **AI 資料工具精簡為 3 支**（個幣綜合 / 市場總覽 / 知識庫） | 控制 token 與工具迴圈複雜度；個幣三面向（行情/技術/新聞）併成一支 `getCoinAnalysis`，最貼合「進場前一次體檢」。依據：AI 研究 agent「工具回傳只給必要欄位、控制 token」+ 使用者指示「最多 3 支」。 |
| **RAG 用 OpenAI File Search（不自建向量庫）** | hosted 向量庫＋檢索＋引用一站式，免維運嵌入/索引/相似度；用 OpenAI 內建 `file_search` 工具（AI SDK 透過 `openai.tools.fileSearch()` 或 Responses API 整合，實作前確認版本支援）。依據：使用者指示 + OpenAI File Search 為 hosted 方案。 |
| **產品數據用 Railway Postgres + `postgres` driver** | 與部署平台同生態、零額外帳號；輕量 `postgres` driver 足夠（P1 不引入重 ORM，YAGNI）。依據：使用者指示用 Railway Postgres。 |
| ~~answer-tool 結構化風險摘要~~（移至 **P2**） | 無 `execute` 的 `answer` 工具 + Zod schema 結構化收尾——P1 先用串流 markdown 回答，結構化風險卡屬 P2。來源：AI SDK v5 agents.mdx。 |
| **`useChat` + `message.parts`（前端）** | 訊息為結構化 parts（text/tool/source），天生適合「文字＋工具步驟＋來源」混排；自動管理串流/status/stop。來源：AI SDK v5 `02-chatbot.mdx`、`generative-user-interfaces.mdx`。 |
| **`react-markdown` + `remark-gfm`** | 預設不使用 `dangerouslySetInnerHTML`，防 XSS；串流友善（半截 markdown 後續補上）。來源：`remarkjs/react-markdown` Security。 |
| **CoinGecko Demo key（`x-cg-demo-api-key`）+ 30/min、10k/月 預算** | 免費穩定額度需 Demo key；保守以 30/min 規劃。來源：CoinGecko docs common-errors-rate-limit、setting-up-your-api-key。 |
| **CryptoPanic developer **v2** URL + `instruments` 欄位 + 最長 TTL** | v1 已轉 v2，base URL 改 `…/api/developer/v2/posts/`，免費月額度僅約 1000（最稀缺）。來源：CryptoPanic developers API、dltHub 文件。 |
| **快取用 `fetch(url,{next:{revalidate}})` + stale fallback** | Next 15+ fetch 預設不快取；對外部 API 配額友善、429 時回上次成功資料。來源：Next.js v16 caching 文件、CoinGecko rate-limit 研究。 |
| **`technicalindicators`（MACD 帶旗標、輸出尾端對齊、資料不足防護）** | 生態最成熟；MACD `SimpleMAOscillator/SimpleMASignal:false` 必填、輸出比輸入短需對齊、`length<period` 回空陣列。來源：`anandanand84/technicalindicators` README。 |
| **波動率用對數報酬標準差、年化 √365** | 加密 24/7，年化用 √365 而非股市 252。來源：技術指標研究 agent。 |
| **lightweight-charts v5（主價格圖）+ Recharts（sparkline）** | lightweight-charts 為金融設計、canvas 高效、體積小（v5 用 `addSeries(CandlestickSeries,…)`，需 `dynamic ssr:false`）；Recharts 宣告式適合迷你走勢。來源：`tradingview/lightweight-charts` v5、`recharts/recharts` v3。 |
| **測試：`node` 環境跑純函式、`ai/test` 的 `MockLanguageModelV4` 測 LLM、`vite-tsconfig-paths`** | async Server Component 官方建議用 E2E 不用 Vitest；LLM 走 provider 抽象注入 mock model 最確定性。來源：Next.js testing/vitest.mdx、AI SDK `55-testing.mdx`。 |

## Global Constraints

- 專案位置：`claude專案/cryptosense/`（獨立 npm 專案）。
- 部署目標：**Railway**（非 Vercel）。需可建置出 production Next.js 並在 Railway 上以公開網址運行；env 機密在 Railway 專案變數設定。注意：因採 Railway，避免依賴 Vercel 專屬功能（如 Edge Runtime 限定 API）；`/api/chat` 串流用標準 Web Streams 即可跨平台。（「Vercel AI SDK」是函式庫名稱，與部署平台無關，照用。）
- 機密金鑰走 env：`OPENAI_API_KEY`、`COINGECKO_DEMO_KEY`、`CRYPTOPANIC_TOKEN`、`OPENAI_VECTOR_STORE_ID`（File Search 知識庫 id）、`DATABASE_URL`（Railway Postgres）（放 `.env.local`，不入 git）。對外資料模組頂部加 `import "server-only"`。
- 資料工具回傳型別一律 `ToolResult<T> = { data: T | null; source: string; timestamp: string; error?: string }`；錯誤回 `error` 且 `data:null`，**不得編造數字**。
- 顏色：**綠漲紅跌**（crypto 慣例），全站統一；狀態用「圖示＋文字＋顏色」三重編碼。
- 只用免費/公開 API；每個外部呼叫帶快取 TTL 並有 stale fallback。TTL：markets 90s、global 300s、coin 180s、OHLC 600s、F&G 3600s、**CryptoPanic 1200s（額度最稀缺）**。
- TDD：含邏輯的 task 先寫失敗測試。純函式測試用 `node` 環境。頻繁 commit。
- 對應 spec 成功條件：見 [spec](../specs/2026-06-19-cryptosense-spec.md) §4。
- 執行順序：RAG（File Search，Task 9）排在 AI 問答（Task 11）之前完成，呼應「先把 RAG 建構出來」。
- P1 **納入**：File Search RAG、Railway Postgres 數據紀錄（query_logs / feedback）。
- P1 **不做**：自建向量庫、觀測數據 dashboard（只先寫 DB，視覺化留 P1.5）、鏈上深度數據、影片/圖片、帳號、進階風險彙整卡。

---

### Task 0: 專案 scaffold 與測試環境

**Files:**
- Create: `cryptosense/`（Next.js 專案）、`cryptosense/vitest.config.mts`、`cryptosense/vitest.setup.ts`、`cryptosense/.env.local.example`

**Interfaces:**
- Produces: 可運行的 Next.js 專案；`npm test` 跑 Vitest（jsdom + node 分層）；AI SDK 與圖表/markdown 套件就緒。

- [ ] **Step 1: 建立 Next.js 專案**

```bash
cd "C:/Users/user/OneDrive/Desktop/claude專案"
npx create-next-app@latest cryptosense --typescript --tailwind --app --eslint --src-dir=false --import-alias "@/*" --no-turbopack
cd cryptosense
```

- [ ] **Step 2: 安裝相依套件（依「技術選型與依據」表）**

```bash
npm install ai @ai-sdk/openai @ai-sdk/react zod technicalindicators lightweight-charts recharts react-markdown remark-gfm server-only
npm install -D vitest @vitejs/plugin-react @testing-library/react @testing-library/user-event @testing-library/jest-dom jsdom vite-tsconfig-paths
npx shadcn@latest init -d
```

- [ ] **Step 3: 設定 Vitest（node/jsdom 分層 + path alias）**

`cryptosense/vitest.config.mts`（依據：測試研究——純函式用 node、用 vite-tsconfig-paths 對齊 `@/*`）:
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

> 純函式測試檔（如技術指標）首行加 `// @vitest-environment node` 以跳過 jsdom，加速。

- [ ] **Step 4: env 範例**

`cryptosense/.env.local.example`:
```
OPENAI_API_KEY=sk-...
COINGECKO_DEMO_KEY=
CRYPTOPANIC_TOKEN=
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
git commit -m "chore: scaffold cryptosense (Next.js + AI SDK v5 + Vitest)"
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

- [ ] **Step 1: 寫失敗測試**

`cryptosense/lib/tools/http.test.ts`（依據：CoinGecko 研究——429 時 stale fallback）:
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

`cryptosense/lib/tools/market.test.ts`（依據：CoinGecko 研究端點/欄位、F&G value 為字串需轉型）:
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

### Task 3: 個幣資料與 OHLCV 工具

**Files:**
- Create: `cryptosense/lib/tools/coin.ts`, `cryptosense/lib/tools/coin.test.ts`

**Interfaces:**
- Consumes: `ok`, `fail`, `cachedFetch`。
- Produces:
  - `type CoinData = { id; symbol; name; price; change24h; marketCap; volume24h; circulatingSupply }`
  - `function getCoinData(id: string): Promise<ToolResult<CoinData>>`（TTL 180s）
  - `type Candle = { t: number; o; h; l; c }`（`t` 為毫秒）
  - `function getOHLCV(id: string, days?: number): Promise<ToolResult<Candle[]>>`（TTL 600s）

- [ ] **Step 1: 寫失敗測試**

`cryptosense/lib/tools/coin.test.ts`（依據：CoinGecko OHLC 為毫秒時間戳、coin 詳情關閉多餘區塊）:
```ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { getCoinData, getOHLCV } from "./coin";
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
});

describe("getOHLCV", () => {
  it("maps [t,o,h,l,c] tuples (ms timestamp)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true,
      json: () => Promise.resolve([[1718000000000, 3500, 3600, 3480, 3540]]) }));
    const r = await getOHLCV("ethereum", 30);
    expect(r.data![0]).toEqual({ t: 1718000000000, o: 3500, h: 3600, l: 3480, c: 3540 });
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
export type Candle = { t: number; o: number; h: number; l: number; c: number };

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

export async function getOHLCV(id: string, days = 30): Promise<ToolResult<Candle[]>> {
  try {
    const rows = await cachedFetch(`${CG}/coins/${id}/ohlc?vs_currency=usd&days=${days}`, { ttlMs: 600_000, headers: cgHeaders() });
    return ok(rows.map((r: number[]) => ({ t: r[0], o: r[1], h: r[2], l: r[3], c: r[4] })), "CoinGecko");
  } catch (e: any) { return fail("CoinGecko", e.message); }
}
```

- [ ] **Step 4: 跑測試確認通過** — Run: `npm test -- coin` → PASS。

- [ ] **Step 5: Commit**

```bash
git add cryptosense/lib/tools/coin.ts cryptosense/lib/tools/coin.test.ts
git commit -m "feat: coin data + OHLCV tools"
```

---

### Task 4: 技術指標計算（尾端對齊 + 資料不足防護）

**Files:**
- Create: `cryptosense/lib/tools/technical.ts`, `cryptosense/lib/tools/technical.test.ts`

**Interfaces:**
- Consumes: `Candle`；`technicalindicators`。
- Produces:
  - `type Signal = "bullish" | "bearish" | "neutral" | "overbought" | "oversold"`
  - `type TechnicalSignals = { rsi: number | null; rsiSignal: Signal; macdSignal: Signal; maTrend: Signal; volatilityPct: number | null; insufficientData: boolean }`
  - `function calcTechnicalSignals(candles: Candle[]): TechnicalSignals` — 純函式；資料不足時 `insufficientData:true`、數值為 `null`。

- [ ] **Step 1: 寫失敗測試**

`cryptosense/lib/tools/technical.test.ts`（依據：技術指標研究——資料不足回空陣列要防護、RSI 70/30、對數報酬波動率）:
```ts
// @vitest-environment node
import { describe, it, expect } from "vitest";
import { calcTechnicalSignals } from "./technical";
import type { Candle } from "./coin";

const series = (p: number[]): Candle[] => p.map((c, i) => ({ t: i, o: c, h: c, l: c, c }));

describe("calcTechnicalSignals", () => {
  it("flags overbought + bullish on monotonic rise", () => {
    const s = calcTechnicalSignals(series(Array.from({ length: 40 }, (_, i) => 100 + i * 2)));
    expect(s.insufficientData).toBe(false);
    expect(s.rsi!).toBeGreaterThan(70);
    expect(s.rsiSignal).toBe("overbought");
    expect(s.maTrend).toBe("bullish");
  });
  it("flags oversold on monotonic fall", () => {
    const s = calcTechnicalSignals(series(Array.from({ length: 40 }, (_, i) => 200 - i * 2)));
    expect(s.rsi!).toBeLessThan(30);
    expect(s.rsiSignal).toBe("oversold");
  });
  it("sets insufficientData when too few candles", () => {
    const s = calcTechnicalSignals(series([100, 101, 102]));
    expect(s.insufficientData).toBe(true);
    expect(s.rsi).toBeNull();
  });
});
```

- [ ] **Step 2: 跑測試確認失敗** — Run: `npm test -- technical` → FAIL。

- [ ] **Step 3: 實作**

`cryptosense/lib/tools/technical.ts`:
```ts
import { RSI, MACD, SMA } from "technicalindicators";
import type { Candle } from "./coin";

export type Signal = "bullish" | "bearish" | "neutral" | "overbought" | "oversold";
export type TechnicalSignals = { rsi: number | null; rsiSignal: Signal; macdSignal: Signal; maTrend: Signal; volatilityPct: number | null; insufficientData: boolean };

const last = <T,>(a: T[]): T | undefined => a[a.length - 1];

export function calcTechnicalSignals(candles: Candle[]): TechnicalSignals {
  const closes = candles.map((c) => c.c);
  // MACD 需 slowPeriod(26)+signalPeriod(9) ≈ 34 根才有第一個 signal 值（依據：技術指標研究）
  if (closes.length < 34) {
    return { rsi: null, rsiSignal: "neutral", macdSignal: "neutral", maTrend: "neutral", volatilityPct: null, insufficientData: true };
  }
  const rsi = last(RSI.calculate({ values: closes, period: 14 }))!;
  const rsiSignal: Signal = rsi >= 70 ? "overbought" : rsi <= 30 ? "oversold" : "neutral";

  const m = last(MACD.calculate({ values: closes, fastPeriod: 12, slowPeriod: 26, signalPeriod: 9, SimpleMAOscillator: false, SimpleMASignal: false }));
  const macdSignal: Signal = m && m.MACD! > m.signal! ? "bullish" : "bearish";

  const ma20 = last(SMA.calculate({ values: closes, period: 20 }))!;
  const ma60 = last(SMA.calculate({ values: closes, period: Math.min(60, closes.length) }))!;
  const price = last(closes)!;
  const maTrend: Signal = price > ma20 && ma20 >= ma60 ? "bullish" : price < ma20 ? "bearish" : "neutral";

  // 對數報酬標準差（依據：技術指標研究）
  const rets = closes.slice(1).map((c, i) => Math.log(c / closes[i]));
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
  const variance = rets.reduce((a, b) => a + (b - mean) ** 2, 0) / (rets.length - 1);
  const volatilityPct = Math.sqrt(variance) * 100;

  return {
    rsi: Math.round(rsi * 10) / 10, rsiSignal, macdSignal, maTrend,
    volatilityPct: Math.round(volatilityPct * 100) / 100, insufficientData: false,
  };
}
```

- [ ] **Step 4: 跑測試確認通過** — Run: `npm test -- technical` → PASS。

- [ ] **Step 5: Commit**

```bash
git add cryptosense/lib/tools/technical.ts cryptosense/lib/tools/technical.test.ts
git commit -m "feat: technical signals with insufficient-data guard"
```

---

### Task 5: 新聞工具（CryptoPanic v2）

**Files:**
- Create: `cryptosense/lib/tools/news.ts`, `cryptosense/lib/tools/news.test.ts`

**Interfaces:**
- Consumes: `ok`, `fail`, `cachedFetch`。
- Produces:
  - `type NewsItem = { title; url; publishedAt; sentiment: "positive"|"negative"|"neutral" }`
  - `function getCryptoNews(symbol?: string): Promise<ToolResult<NewsItem[]>>`（developer v2，TTL 1200s）

- [ ] **Step 1: 寫失敗測試**

`cryptosense/lib/tools/news.test.ts`（依據：CryptoPanic v2 URL、votes 推情緒）:
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

### Task 6: 資料 API routes（market + coin，含 revalidate）

**Files:**
- Create: `cryptosense/app/api/market/route.ts`, `cryptosense/app/api/coin/[id]/route.ts`, `cryptosense/app/api/coin/[id]/route.test.ts`

**Interfaces:**
- Consumes: 全部 `lib/tools/*`。
- Produces:
  - `GET /api/market` → `{ overview; fearGreed }`
  - `GET /api/coin/[id]` → `{ coin; technical; news }`（technical 為 `ToolResult<TechnicalSignals>`）

- [ ] **Step 1: 寫失敗測試**

`cryptosense/app/api/coin/[id]/route.test.ts`（依據：測試研究——route handler 用 vi.mock 換掉 lib、傳 Request、await params）:
```ts
// @vitest-environment node
import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/tools/coin", () => ({
  getCoinData: vi.fn().mockResolvedValue({ data: { id: "ethereum", symbol: "ETH", name: "Ethereum", price: 3540, change24h: -0.82, marketCap: 1, volume24h: 1, circulatingSupply: 1 }, source: "CoinGecko", timestamp: "t" }),
  getOHLCV: vi.fn().mockResolvedValue({ data: [{ t: 1, o: 1, h: 1, l: 1, c: 1 }], source: "CoinGecko", timestamp: "t" }),
}));
vi.mock("@/lib/tools/technical", () => ({ calcTechnicalSignals: vi.fn().mockReturnValue({ rsi: 68, insufficientData: false }) }));
vi.mock("@/lib/tools/news", () => ({ getCryptoNews: vi.fn().mockResolvedValue({ data: [], source: "CryptoPanic", timestamp: "t" }) }));

import { GET } from "./route";

describe("GET /api/coin/[id]", () => {
  it("returns coin/technical/news bundle", async () => {
    const res = await GET(new Request("http://x/api/coin/ethereum"), { params: Promise.resolve({ id: "ethereum" }) });
    const body = await res.json();
    expect(body.coin.data.symbol).toBe("ETH");
    expect(body.technical.data.rsi).toBe(68);
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
import { getCoinData, getOHLCV } from "@/lib/tools/coin";
import { calcTechnicalSignals } from "@/lib/tools/technical";
import { getCryptoNews } from "@/lib/tools/news";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [coin, ohlcv] = await Promise.all([getCoinData(id), getOHLCV(id, 30)]);
  const technical = ohlcv.data
    ? { data: calcTechnicalSignals(ohlcv.data), source: ohlcv.source, timestamp: ohlcv.timestamp }
    : { data: null, source: ohlcv.source, timestamp: ohlcv.timestamp, error: ohlcv.error };
  const news = await getCryptoNews(coin.data?.symbol);
  return NextResponse.json({ coin, technical, news });
}
```

- [ ] **Step 4: 跑測試確認通過** — Run: `npm test -- "coin/\[id\]"` → PASS。

- [ ] **Step 5: Commit**

```bash
git add cryptosense/app/api/market cryptosense/app/api/coin
git commit -m "feat: market and coin data API routes"
```

---

### Task 7: 市場總覽 Dashboard UI（方向 B）+ Recharts sparkline

**Files:**
- Create: `cryptosense/lib/format.ts`, `cryptosense/components/Sparkline.tsx`, `cryptosense/components/MarketDashboard.tsx`, `cryptosense/components/MarketDashboard.test.tsx`
- Modify: `cryptosense/app/page.tsx`

**Interfaces:**
- Consumes: `MarketOverview`, `FearGreed`。
- Produces: `MarketDashboard({ overview, fearGreed })`；`pct`, `usdCompact`, `changeClass` from `lib/format`；`Sparkline({ data })`（Recharts，client）。

- [ ] **Step 1: 寫失敗測試**

`cryptosense/components/MarketDashboard.test.tsx`（依據：spec §4 F1、綠漲紅跌雙重編碼）:
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

`cryptosense/components/Sparkline.tsx`（依據：圖表研究——Recharts 做 sparkline、需 'use client'）:
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

- [ ] **Step 5: 接首頁（Server Component，依據：Next.js 研究 force-dynamic）**

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
git commit -m "feat: market dashboard (layout B) with sparklines"
```

---

### Task 8: 個幣分析頁 UI + lightweight-charts 價格圖

**Files:**
- Create: `cryptosense/components/PriceChart.tsx`, `cryptosense/components/CoinDetail.tsx`, `cryptosense/components/CoinDetail.test.tsx`, `cryptosense/app/coin/[id]/page.tsx`

**Interfaces:**
- Consumes: `CoinData`, `TechnicalSignals`, `NewsItem`, `Candle`；`changeClass`, `pct`。
- Produces:
  - `PriceChart({ candles })` — client，`dynamic(..., {ssr:false})` 載入（依據：圖表研究）。
  - `CoinDetail({ coin, technical, news, candles, updatedAt })`。

- [ ] **Step 1: 寫失敗測試**

`cryptosense/components/CoinDetail.test.tsx`（依據：spec §4 F2）:
```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("./PriceChart", () => ({ PriceChart: () => <div data-testid="price-chart" /> }));
import { CoinDetail } from "./CoinDetail";

const coin = { id: "ethereum", symbol: "ETH", name: "Ethereum", price: 3540.18, change24h: -0.82, marketCap: 1, volume24h: 1, circulatingSupply: 1 };
const technical = { rsi: 68, rsiSignal: "neutral" as const, macdSignal: "bullish" as const, maTrend: "bullish" as const, volatilityPct: 2.1, insufficientData: false };

describe("CoinDetail", () => {
  it("renders header, technical, chart, CTA", () => {
    render(<CoinDetail coin={coin} technical={technical} news={[]} candles={[]} updatedAt="2026-06-19 14:32" />);
    expect(screen.getByText(/Ethereum/)).toBeInTheDocument();
    expect(screen.getByText("68")).toBeInTheDocument();
    expect(screen.getByTestId("price-chart")).toBeInTheDocument();
    expect(screen.getByText(/我現在該進場/)).toBeInTheDocument();
  });
  it("shows insufficient-data note when technical is null/insufficient", () => {
    render(<CoinDetail coin={coin} technical={null} news={[]} candles={[]} updatedAt="t" />);
    expect(screen.getByText(/技術面資料暫時取不到/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 跑測試確認失敗** — Run: `npm test -- CoinDetail` → FAIL。

- [ ] **Step 3: 實作 PriceChart**

`cryptosense/components/PriceChart.tsx`（依據：圖表研究——v5 `addSeries(CandlestickSeries,…)`、cleanup `remove()`、秒級時間）:
```tsx
"use client";
import { useEffect, useRef } from "react";
import { createChart, CandlestickSeries } from "lightweight-charts";
import type { Candle } from "@/lib/tools/coin";

export function PriceChart({ candles }: { candles: Candle[] }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current || candles.length === 0) return;
    const chart = createChart(ref.current, { autoSize: true, layout: { background: { color: "transparent" }, textColor: "#94a3b8" } });
    const series = chart.addSeries(CandlestickSeries, { upColor: "#22c55e", downColor: "#ef4444", wickUpColor: "#22c55e", wickDownColor: "#ef4444", borderVisible: false });
    series.setData(candles.map((c) => ({ time: Math.floor(c.t / 1000) as any, open: c.o, high: c.h, low: c.l, close: c.c })));
    chart.timeScale().fitContent();
    return () => chart.remove();
  }, [candles]);
  return <div ref={ref} className="h-64 w-full" />;
}
```

- [ ] **Step 4: 實作 CoinDetail**

`cryptosense/components/CoinDetail.tsx`:
```tsx
import dynamic from "next/dynamic";
import Link from "next/link";
import type { CoinData, Candle } from "@/lib/tools/coin";
import type { TechnicalSignals } from "@/lib/tools/technical";
import type { NewsItem } from "@/lib/tools/news";
import { pct, changeClass } from "@/lib/format";

const PriceChart = dynamic(() => import("./PriceChart").then((m) => m.PriceChart), { ssr: false });

const sig: Record<string, string> = { bullish: "多方", bearish: "空方", neutral: "中性", overbought: "接近超買", oversold: "接近超賣" };
const sent: Record<string, string> = { positive: "利多", negative: "利空", neutral: "中性" };

export function CoinDetail({ coin, technical, news, candles, updatedAt }: { coin: CoinData; technical: TechnicalSignals | null; news: NewsItem[]; candles: Candle[]; updatedAt: string }) {
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

      <section className="rounded-lg border border-slate-800 bg-slate-900 p-3">
        <h2 className="mb-2 font-semibold text-white">📈 價格走勢</h2>
        <PriceChart candles={candles} />
      </section>

      <section className="rounded-lg border border-slate-800 bg-slate-900 p-3">
        <h2 className="mb-2 font-semibold text-white">📊 技術面訊號</h2>
        {technical && !technical.insufficientData ? (
          <table className="w-full text-sm"><tbody>
            <tr><td>RSI(14)</td><td>{technical.rsi}</td><td>{sig[technical.rsiSignal]}</td></tr>
            <tr><td>MACD</td><td>{sig[technical.macdSignal]}</td><td /></tr>
            <tr><td>均線趨勢</td><td>{sig[technical.maTrend]}</td><td /></tr>
            <tr><td>波動度</td><td>{technical.volatilityPct}%</td><td /></tr>
          </tbody></table>
        ) : <p className="text-slate-400">技術面資料暫時取不到（資料不足或來源異常）。</p>}
        <div className="mt-1 text-[10px] text-sky-400">來源：CoinGecko OHLCV，本地計算 · {updatedAt}</div>
      </section>

      <section className="rounded-lg border border-slate-800 bg-slate-900 p-3">
        <h2 className="mb-2 font-semibold text-white">📰 新聞與情緒</h2>
        {news.length ? news.map((n, i) => (
          <div key={i} className="border-t border-slate-800 py-1 text-sm">
            <a className="text-sky-400 hover:underline" href={n.url} target="_blank" rel="noopener noreferrer">{n.title}</a>{" "}
            <span data-testid={`news-sentiment-${i}`} className={n.sentiment === "negative" ? "text-red-500" : n.sentiment === "positive" ? "text-green-500" : "text-slate-400"}>{sent[n.sentiment]}</span>
          </div>
        )) : <p className="text-slate-400">近期無新聞。</p>}
      </section>

      <Link href={`/coin/${coin.id}?chat=1`} className="block w-full rounded-lg bg-blue-600 py-3 text-center font-semibold text-white">
        💬 針對 {coin.symbol} 問 AI：「我現在該進場嗎？」</Link>
    </div>
  );
}
```

- [ ] **Step 5: 實作頁面**

`cryptosense/app/coin/[id]/page.tsx`:
```tsx
import { CoinDetail } from "@/components/CoinDetail";
import { getCoinData, getOHLCV } from "@/lib/tools/coin";
import { calcTechnicalSignals } from "@/lib/tools/technical";
import { getCryptoNews } from "@/lib/tools/news";

export const dynamic = "force-dynamic";

export default async function CoinPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [coin, ohlcv] = await Promise.all([getCoinData(id), getOHLCV(id, 30)]);
  const candles = ohlcv.data ?? [];
  const technical = ohlcv.data ? calcTechnicalSignals(ohlcv.data) : null;
  const news = coin.data ? (await getCryptoNews(coin.data.symbol)).data ?? [] : [];
  return (
    <main className="mx-auto max-w-3xl p-6">
      {coin.data
        ? <CoinDetail coin={coin.data} technical={technical} news={news} candles={candles} updatedAt={new Date(coin.timestamp).toLocaleString()} />
        : <p className="text-slate-400">找不到此幣資料。</p>}
    </main>
  );
}
```

- [ ] **Step 6: 跑測試 + 手動驗證** — Run: `npm test -- CoinDetail` → PASS；`npm run dev` 進 /coin/ethereum 確認 K 線圖、技術面、新聞、CTA。

- [ ] **Step 7: Commit**

```bash
git add cryptosense/components/PriceChart.tsx cryptosense/components/CoinDetail.tsx cryptosense/components/CoinDetail.test.tsx cryptosense/app/coin/[id]/page.tsx
git commit -m "feat: coin detail page with lightweight-charts price chart"
```

---

### Task 9: 個人知識庫 RAG（OpenAI File Search）

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

把幾個文字檔放進 `cryptosense/knowledge/`，Run: `npx tsx scripts/ingest.ts ./knowledge`（或 `node --loader tsx`）。把印出的 `OPENAI_VECTOR_STORE_ID` 填進 `.env.local`。
正確完成判準：`searchKnowledgeBase("...")` 在 dev 環境能回傳相關片段＋來源檔名。

- [ ] **Step 8: Commit**

```bash
git add cryptosense/lib/rag cryptosense/scripts/ingest.ts cryptosense/knowledge/.gitkeep
git commit -m "feat: knowledge base RAG via OpenAI File Search"
```

---

### Task 10: 產品數據紀錄（Railway Postgres：query_logs / feedback）

**Files:**
- Create: `cryptosense/lib/db/client.ts`, `cryptosense/lib/db/schema.sql`, `cryptosense/lib/db/log.ts`, `cryptosense/lib/db/log.test.ts`, `cryptosense/app/api/feedback/route.ts`

**Interfaces:**
- Consumes: `postgres` driver；`DATABASE_URL`。
- Produces:
  - `const sql` — postgres client（lazy）。
  - `function logQuery(e: { sessionId; coinId?; question; answer; toolsUsed: string[]; cited: boolean; turnIndex: number; latencyMs: number }): Promise<void>`
  - `function recordFeedback(e: { sessionId; rating: "up"|"down" }): Promise<void>` — 綁定該 session 最近一筆 query_log。
  - `POST /api/feedback` body `{ sessionId, rating }`。

- [ ] **Step 1: 寫 schema**

`cryptosense/lib/db/schema.sql`（依據：CP5 已確認欄位）:
```sql
CREATE TABLE IF NOT EXISTS query_logs (
  id           BIGSERIAL PRIMARY KEY,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  session_id   TEXT NOT NULL,
  coin_id      TEXT,
  question     TEXT NOT NULL,
  answer       TEXT,
  tools_used   TEXT[] NOT NULL DEFAULT '{}',
  cited        BOOLEAN NOT NULL DEFAULT false,
  turn_index   INT NOT NULL DEFAULT 1,
  latency_ms   INT
);
CREATE TABLE IF NOT EXISTS feedback (
  id            BIGSERIAL PRIMARY KEY,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  query_log_id  BIGINT REFERENCES query_logs(id),
  session_id    TEXT NOT NULL,
  rating        TEXT NOT NULL CHECK (rating IN ('up','down')),
  comment       TEXT
);
```

- [ ] **Step 2: 寫失敗測試（log 函式組裝正確 SQL 參數）**

`cryptosense/lib/db/log.test.ts`:
```ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

const calls: any[] = [];
vi.mock("./client", () => {
  const sql: any = (strings: TemplateStringsArray, ...vals: any[]) => { calls.push(vals); return Promise.resolve([{ id: 7 }]); };
  return { sql };
});

import { logQuery } from "./log";

beforeEach(() => { calls.length = 0; });

describe("logQuery", () => {
  it("passes question/cited/turnIndex into the query", async () => {
    await logQuery({ sessionId: "s1", coinId: "ethereum", question: "ETH?", answer: "...", toolsUsed: ["getCoinAnalysis"], cited: true, turnIndex: 2, latencyMs: 1200 });
    const flat = calls.flat();
    expect(flat).toContain("s1");
    expect(flat).toContain("ETH?");
    expect(flat).toContain(true);
    expect(flat).toContain(2);
  });
});
```

- [ ] **Step 3: 跑測試確認失敗** — Run: `npm test -- "db/log"` → FAIL。

- [ ] **Step 4: 實作 client + log**

`cryptosense/lib/db/client.ts`:
```ts
import "server-only";
import postgres from "postgres";
export const sql = postgres(process.env.DATABASE_URL ?? "", { prepare: false });
```

`cryptosense/lib/db/log.ts`:
```ts
import "server-only";
import { sql } from "./client";

export async function logQuery(e: { sessionId: string; coinId?: string; question: string; answer?: string; toolsUsed: string[]; cited: boolean; turnIndex: number; latencyMs: number }): Promise<void> {
  await sql`INSERT INTO query_logs (session_id, coin_id, question, answer, tools_used, cited, turn_index, latency_ms)
    VALUES (${e.sessionId}, ${e.coinId ?? null}, ${e.question}, ${e.answer ?? null}, ${e.toolsUsed}, ${e.cited}, ${e.turnIndex}, ${e.latencyMs})`;
}

export async function recordFeedback(e: { sessionId: string; rating: "up" | "down" }): Promise<void> {
  await sql`INSERT INTO feedback (query_log_id, session_id, rating)
    VALUES ((SELECT id FROM query_logs WHERE session_id = ${e.sessionId} ORDER BY id DESC LIMIT 1), ${e.sessionId}, ${e.rating})`;
}
```

- [ ] **Step 5: 跑測試確認通過** — Run: `npm test -- "db/log"` → PASS。

- [ ] **Step 6: feedback API route**

`cryptosense/app/api/feedback/route.ts`:
```ts
import { NextResponse } from "next/server";
import { recordFeedback } from "@/lib/db/log";

export async function POST(req: Request) {
  const { sessionId, rating } = await req.json();
  if (rating !== "up" && rating !== "down") return NextResponse.json({ error: "bad rating" }, { status: 400 });
  await recordFeedback({ sessionId, rating });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 7: 建表（dev 與 Railway 都要跑一次 schema.sql）**

dev：對本機/Railway 的 `DATABASE_URL` 執行 `schema.sql`（`psql "$DATABASE_URL" -f lib/db/schema.sql`）。
正確完成判準：兩張表存在；`POST /api/feedback` 在 dev 可成功寫入一筆。

- [ ] **Step 8: Commit**

```bash
git add cryptosense/lib/db cryptosense/app/api/feedback
git commit -m "feat: Railway Postgres logging (query_logs/feedback) + feedback API"
```

---

### Task 11: AI 問答後端（AI SDK streamText + 3 工具 + 寫入 query_logs）

**Files:**
- Create: `cryptosense/lib/ai/prompt.ts`, `cryptosense/lib/ai/tools.ts`, `cryptosense/lib/ai/tools.test.ts`, `cryptosense/lib/ai/chat.ts`, `cryptosense/lib/ai/chat.test.ts`, `cryptosense/app/api/chat/route.ts`

**Interfaces:**
- Consumes: `lib/tools/*`、`lib/rag/fileSearch`、`lib/db/log`；`ai`、`@ai-sdk/openai`、`zod`。
- Produces:
  - `const SYSTEM_PROMPT: string`
  - `const cryptoTools` — **3 支**：`{ getCoinAnalysis, getMarketOverview, searchKnowledgeBase }`（各為 `tool()`）。`getCoinAnalysis` 一次回行情＋技術＋新聞。
  - `function runChat(opts: { messages; coinId?; sessionId?; model? }): ReturnType<typeof streamText>` — model 可注入；當有 `sessionId` 時於 `onFinish` 寫入 `query_logs`（`cited` = 是否呼叫過工具/知識庫）。
  - `POST /api/chat` → `runChat(...).toUIMessageStreamResponse()`。

- [ ] **Step 1: 寫失敗測試（工具 execute + chat 串流）**

`cryptosense/lib/ai/tools.test.ts`（依據：AI SDK tool() + execute；3 支工具）:
```ts
// @vitest-environment node
import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/tools/coin", () => ({
  getCoinData: vi.fn().mockResolvedValue({ data: { symbol: "ETH" }, source: "CoinGecko", timestamp: "t" }),
  getOHLCV: vi.fn().mockResolvedValue({ data: [{ t: 1, o: 1, h: 1, l: 1, c: 1 }], source: "CoinGecko", timestamp: "t" }),
}));
vi.mock("@/lib/tools/technical", () => ({ calcTechnicalSignals: vi.fn().mockReturnValue({ rsi: 68 }) }));
vi.mock("@/lib/tools/news", () => ({ getCryptoNews: vi.fn().mockResolvedValue({ data: [], source: "CryptoPanic", timestamp: "t" }) }));
vi.mock("@/lib/tools/market", () => ({ getMarketOverview: vi.fn(), getFearGreedIndex: vi.fn() }));
vi.mock("@/lib/rag/fileSearch", () => ({ searchKnowledgeBase: vi.fn().mockResolvedValue({ data: [{ text: "x", source: "n.md" }], source: "KnowledgeBase", timestamp: "t" }) }));

import { cryptoTools } from "./tools";

describe("cryptoTools", () => {
  it("exposes exactly 3 tools", () => {
    expect(Object.keys(cryptoTools).sort()).toEqual(["getCoinAnalysis", "getMarketOverview", "searchKnowledgeBase"]);
  });
  it("getCoinAnalysis.execute returns price+technical+news bundle", async () => {
    const r = await (cryptoTools.getCoinAnalysis as any).execute({ id: "ethereum" });
    expect(r.coin.data.symbol).toBe("ETH");
    expect(r.technical.data).toEqual({ rsi: 68 });
    expect(r.news.data).toEqual([]);
  });
});
```

`cryptosense/lib/ai/chat.test.ts`（依據：測試研究——`ai/test` MockLanguageModelV4 + simulateReadableStream，確定性測串流）:
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
能力：用 3 個工具——getCoinAnalysis(行情/技術/新聞)、getMarketOverview(市場總覽)、searchKnowledgeBase(使用者個人知識庫)——協助使用者了解風險與盲點。
規則：
1. 不報明牌、不保證獲利、不給明確「買/賣」指令；用「正面觀點 vs 風險/盲點」呈現，由使用者自行判斷。
2. 所有數字只能來自工具回傳，絕不可自行編造或憑記憶；需要數據時呼叫工具。
3. 每個判斷標註資料來源與時間（用工具回傳的 source/timestamp）。
4. 信心用高/中/低，不用假精確百分比。
5. 先給結論（風險定調），再分「✅ 正面觀點」「⚠️ 風險/盲點」「📊 技術面」「📰 新聞情緒」。
6. 結尾固定附免責：「本內容為 AI 整理之公開資訊，非投資建議，請自行查證評估風險。」
7. 工具回傳 error 時誠實說明該項資料暫時取不到，不要編造。
8. 來自 searchKnowledgeBase 的內容用 📚 標示，與公開資料來源區隔。`;
```

`cryptosense/lib/ai/tools.ts`（3 支：個幣綜合 / 市場總覽 / 知識庫）:
```ts
import { tool } from "ai";
import { z } from "zod";
import { getCoinData, getOHLCV } from "@/lib/tools/coin";
import { calcTechnicalSignals } from "@/lib/tools/technical";
import { getCryptoNews } from "@/lib/tools/news";
import { getMarketOverview } from "@/lib/tools/market";
import { searchKnowledgeBase } from "@/lib/rag/fileSearch";

export const cryptoTools = {
  // 個幣綜合：一次回行情＋技術＋新聞（CP3：三面向併一支）
  getCoinAnalysis: tool({
    description: "取得某幣的行情、技術指標(RSI/MACD/均線/波動度)與近期新聞情緒",
    inputSchema: z.object({ id: z.string().describe("CoinGecko id, 如 ethereum"), symbol: z.string().describe("幣符號如 ETH") }),
    execute: async ({ id, symbol }) => {
      const [coin, ohlcv, news] = await Promise.all([getCoinData(id), getOHLCV(id, 30), getCryptoNews(symbol)]);
      const technical = ohlcv.data
        ? { data: calcTechnicalSignals(ohlcv.data), source: ohlcv.source, timestamp: ohlcv.timestamp }
        : ohlcv;
      return { coin, technical, news };
    },
  }),
  getMarketOverview: tool({
    description: "取得整體市場總覽（市值/量/BTC主導/恐懼貪婪）",
    inputSchema: z.object({}),
    execute: async () => getMarketOverview(),
  }),
  // 知識庫：OpenAI File Search（CP1）
  searchKnowledgeBase: tool({
    description: "檢索使用者的個人知識庫（自有筆記/對話），回傳帶來源的片段",
    inputSchema: z.object({ query: z.string() }),
    execute: async ({ query }) => searchKnowledgeBase(query),
  }),
};
```

- [ ] **Step 4: 實作 chat（model 可注入）**

`cryptosense/lib/ai/chat.ts`（依據：AI SDK v5 streamText + stopWhen + convertToModelMessages + onFinish 寫 query_logs）:
```ts
import { streamText, stepCountIs, convertToModelMessages, type LanguageModel, type UIMessage } from "ai";
import { openai } from "@ai-sdk/openai";
import { SYSTEM_PROMPT } from "./prompt";
import { cryptoTools } from "./tools";
import { logQuery } from "@/lib/db/log";

function lastUserText(messages: UIMessage[]): string {
  const u = [...messages].reverse().find((m) => m.role === "user");
  return (u?.parts ?? []).filter((p: any) => p.type === "text").map((p: any) => p.text).join(" ");
}

export function runChat({ messages, coinId, sessionId, model }: { messages: UIMessage[]; coinId?: string; sessionId?: string; model?: LanguageModel }) {
  const system = coinId ? `${SYSTEM_PROMPT}\n\n目前使用者正在看的幣 id：${coinId}` : SYSTEM_PROMPT;
  const startedAt = Date.now();
  const turnIndex = messages.filter((m) => m.role === "user").length; // 第幾輪問答（互動深度指標）
  return streamText({
    model: model ?? openai("gpt-4o"),
    system,
    messages: convertToModelMessages(messages),
    tools: cryptoTools,
    stopWhen: stepCountIs(6),
    onFinish: async ({ text, steps }) => {
      if (!sessionId) return; // 測試/無 session 不寫 DB
      const toolsUsed = [...new Set((steps ?? []).flatMap((s: any) => (s.toolCalls ?? []).map((t: any) => t.toolName)))];
      try {
        await logQuery({ sessionId, coinId, question: lastUserText(messages), answer: text,
          toolsUsed, cited: toolsUsed.length > 0, turnIndex, latencyMs: Date.now() - startedAt });
      } catch { /* 紀錄失敗不影響回答 */ }
    },
  });
}
```

- [ ] **Step 5: 實作 route**

`cryptosense/app/api/chat/route.ts`（依據：AI SDK toUIMessageStreamResponse + maxDuration）:
```ts
import { runChat } from "@/lib/ai/chat";

export const maxDuration = 30;

export async function POST(req: Request) {
  const { messages, coinId, sessionId } = await req.json();
  const result = runChat({ messages, coinId, sessionId });
  return result.toUIMessageStreamResponse({ onError: () => "分析時發生錯誤，請稍後再試。" });
}
```

- [ ] **Step 6: 跑測試確認通過** — Run: `npm test -- "ai/"` → PASS。

- [ ] **Step 7: Commit**

```bash
git add cryptosense/lib/ai cryptosense/app/api/chat
git commit -m "feat: AI chat backend (3 tools incl. knowledge base + query_logs logging)"
```

---

### Task 12: AI 問答前端（useChat + markdown + chips + 按讚回饋）

**Files:**
- Create: `cryptosense/components/Chat.tsx`, `cryptosense/components/Chat.test.tsx`
- Modify: `cryptosense/app/coin/[id]/page.tsx`（CoinDetail 後加入 Chat）

**Interfaces:**
- Consumes: `POST /api/chat`、`POST /api/feedback`；`@ai-sdk/react` `useChat`、`DefaultChatTransport`、`react-markdown`、`remark-gfm`。
- Produces: `Chat({ coinId, symbol })`（client）；產生匿名 `sessionId`（localStorage）隨 chat 一併送出，並在每則 AI 回答下提供 👍/👎 回饋（POST `/api/feedback`）。

- [ ] **Step 1: 寫失敗測試**

`cryptosense/components/Chat.test.tsx`（依據：spec §4 F3——能力界定、免責、不可「問我任何事」、情境化 chips）:
```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// 隔離 useChat，只測本元件的靜態 UI（能力框/免責/chips）
vi.mock("@ai-sdk/react", () => ({ useChat: () => ({ messages: [], sendMessage: vi.fn(), status: "ready", stop: vi.fn() }) }));
import { Chat } from "./Chat";

describe("Chat", () => {
  it("frames capability + disclaimer, not 'ask me anything'", () => {
    render(<Chat coinId="ethereum" symbol="ETH" />);
    expect(screen.getByText(/風險面、近期新聞與技術面/)).toBeInTheDocument();
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

`cryptosense/components/Chat.tsx`（依據：Chat 前端研究——useChat、message.parts、react-markdown 連結強制 noopener、status 控制 disabled、chips sendMessage）:
```tsx
"use client";
import { useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

function getSessionId(): string {
  if (typeof window === "undefined") return "ssr";
  let id = localStorage.getItem("cs_session");
  if (!id) { id = crypto.randomUUID(); localStorage.setItem("cs_session", id); }
  return id;
}

export function Chat({ coinId, symbol }: { coinId: string; symbol: string }) {
  const [sessionId] = useState(getSessionId);
  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat", body: { coinId, sessionId } }),
  });
  const [input, setInput] = useState("");
  const chips = [`${symbol} 主要下行風險？`, `跟 BTC 比較`, `最新利空新聞`];
  const busy = status !== "ready";

  const submit = (text: string) => { if (text.trim() && !busy) { sendMessage({ text }); setInput(""); } };
  const rate = (rating: "up" | "down") =>
    fetch("/api/feedback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId, rating }) });

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900">
      <div className="flex justify-between border-b border-slate-800 p-2 text-xs text-slate-400">
        <span>💬 AI 研究助手 · 情境：{symbol}</span><span>🤖 AI 生成，非投資建議</span>
      </div>
      <div className="space-y-2 p-3 text-sm" aria-live="polite">
        <div className="rounded border border-slate-700 bg-slate-800 p-2 text-xs">
          👋 我可以幫你了解 <b>{symbol} 的風險面、近期新聞與技術面分析</b>，我不會報明牌或保證獲利。</div>
        {messages.map((m) => (
          <div key={m.id} className={m.role === "user" ? "text-right" : ""}>
            {m.role === "user"
              ? <span className="inline-block rounded bg-blue-600 px-2 py-1 text-white">{m.parts.map((p: any) => p.type === "text" ? p.text : "").join("")}</span>
              : <div className="prose prose-invert max-w-none text-slate-200">
                  {m.parts.map((p: any, i: number) => p.type === "text"
                    ? <Markdown key={i} remarkPlugins={[remarkGfm]} components={{ a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer">{children}</a> }}>{p.text}</Markdown>
                    : null)}
                  {status === "ready" && <div className="mt-1 flex gap-2 text-xs text-slate-400">
                    <button onClick={() => rate("up")} aria-label="讚">👍</button>
                    <button onClick={() => rate("down")} aria-label="倒讚">👎</button>
                  </div>}
                </div>}
          </div>
        ))}
        {status === "submitted" && <div className="text-xs text-slate-400">分析中…</div>}
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

- [ ] **Step 5: 跑測試 + 端到端手動驗證** — Run: `npm test` → 全綠；設 `.env.local` 的 `OPENAI_API_KEY`，`npm run dev`，進 /coin/ethereum 問「我現在該進場嗎？」→ 確認串流 markdown 回答、正反觀點、結尾免責、chips 可用。

- [ ] **Step 6: Commit**

```bash
git add cryptosense/components/Chat.tsx cryptosense/components/Chat.test.tsx cryptosense/app/coin/[id]/page.tsx
git commit -m "feat: AI chat UI (useChat + markdown + chips + thumbs feedback)"
```

---

### Task 13: 部署到 Railway（含 Postgres）

**Files:**
- Create: `cryptosense/.env.local.example`（已存在則確認）；如需，`cryptosense/railway.json` 或 `nixpacks.toml`（多數情況 Railway 可自動偵測 Next.js，免設定檔）。

**Interfaces:**
- Produces: 可公開存取的 Railway 部署網址 + 已建表的 Postgres，對齊 spec §4「可部署到 Railway 並正常操作」與數據紀錄。

- [ ] **Step 1: 確認 production build 可過**

Run: `cd cryptosense && npm run build`
Expected: build 成功（無型別/lint 阻斷錯誤）。若失敗先修。

- [ ] **Step 2: 確認 start 指令與埠**

確認 `package.json` 的 `start` 為 `next start`；Railway 會注入 `PORT`，Next.js `next start` 預設讀 `PORT`，無需改動。

- [ ] **Step 3: 用 Railway 建立 service + Postgres**

使用 railway skill（`use-railway`）或 Railway MCP/CLI：建立專案、加入此 app service（root 設 `cryptosense/`）、**並加掛一個 Postgres 資料庫**（Railway 會提供 `DATABASE_URL` 參考變數）。
（CLI 對應：`railway init` → `railway add`（Postgres）→ `railway up`。）

- [ ] **Step 4: 對 Postgres 建表**

用 Railway 的 `DATABASE_URL` 執行 `lib/db/schema.sql`（`psql "$DATABASE_URL" -f lib/db/schema.sql`），建立 `query_logs` / `feedback`。

- [ ] **Step 5: 設定環境變數**

在 Railway 專案變數加入：`OPENAI_API_KEY`、`COINGECKO_DEMO_KEY`、`CRYPTOPANIC_TOKEN`、`OPENAI_VECTOR_STORE_ID`（Task 9 ingest 產生）、`DATABASE_URL`（引用 Postgres）。

- [ ] **Step 6: 產生公開網址並驗證**

在 Railway 產生 public domain；開啟網址，手動驗證：市場總覽載入 → 點幣進個幣頁 → AI 問答可串流回答 → 按 👍 後 `feedback` 表有一筆、`query_logs` 有對應紀錄。
正確完成判準：上述流程全通，且 DB 兩張表有真實資料寫入。

- [ ] **Step 7: 記錄網址**

把公開網址記到 `cryptosense/README.md`（建立或更新），方便作品集展示。

```bash
git add cryptosense/README.md
git commit -m "docs: record Railway deployment URL"
```

---

## 工時估算與正確完成判準（CP7）

> 估時為單一開發者粗估（含寫測試）；「正確完成判準」是給 AI 執行者的驗收依據（做到才算對）。

| Task | 內容 | 估時 | 正確完成判準 |
|------|------|------|------------|
| 0 | Scaffold + Vitest | 1.5h | `npm test` 跑得起來（冒煙 1 passed）、`npm run dev` 起站 |
| 1 | 型別 + cachedFetch（stale fallback） | 1.5h | http.test 全綠（含 stale fallback、無快取時 throw） |
| 2 | 市場總覽 + F&G 工具 | 1.5h | market.test 全綠；F&G value 轉 number；失敗回 error |
| 3 | 個幣 + OHLCV 工具 | 1h | coin.test 全綠；OHLC 為 ms 時間戳 |
| 4 | 技術指標 | 2h | technical.test 全綠；資料不足 `insufficientData:true` |
| 5 | 新聞工具（CryptoPanic v2） | 1h | news.test 全綠；URL 含 `/api/developer/v2/posts/` |
| 6 | 資料 API routes | 1h | coin route.test 綠；回傳 bundle 結構正確 |
| 7 | 市場 Dashboard UI + sparkline | 2.5h | MarketDashboard.test 綠；綠漲紅跌；點幣可連 detail |
| 8 | 個幣頁 + K 線圖 | 2.5h | CoinDetail.test 綠；圖表 mock 渲染；資料不足顯示提示 |
| 9 | RAG（File Search）+ ingest | 3h | fileSearch.test 綠；dev 能檢索到知識庫片段＋來源 |
| 10 | Postgres（query_logs/feedback）+ feedback API | 2.5h | db/log.test 綠；dev `POST /api/feedback` 寫入成功 |
| 11 | AI 問答後端（3 工具 + 寫 logs） | 2.5h | ai 測試綠（3 工具名、getCoinAnalysis bundle、串流文字） |
| 12 | AI 問答前端（useChat + markdown + 按讚） | 2.5h | Chat.test 綠；端到端串流回答含免責；👍 寫入 feedback |
| 13 | 部署 Railway + Postgres | 2h | 公開網址可操作；DB 兩張表有真實資料 |
| **合計** | | **~29h** | （約 4 個工作天，單人） |

## P1 完成定義（DoD）

- `npm test` 全綠（http/market/coin/technical/news/route/fileSearch/db/AI/UI 元件）。
- `npm run dev` 可操作：市場總覽（方向 B + sparkline）→ 點幣 → 個幣頁（K 線/技術/新聞）→ AI 串流問答（含知識庫引用、正反觀點、免責）→ 👍/👎 回饋。
- 每次問答寫入 `query_logs`（含是否引用、第幾輪、延遲）；按讚寫入 `feedback`。
- 對齊 spec §4 可驗證成功條件；綠漲紅跌全站一致；資料取不到時 graceful（stale fallback / 友善訊息），不崩潰不編造。
- 成功部署到 Railway（含 Postgres），公開網址可正常操作（Task 13）。

## 後續計畫（不在本計畫）

- **P1.5**：觀測數據 dashboard（把 query_logs/feedback 的行為指標——互動深度、引用率、按讚率、回訪、熱門幣——視覺化）。
- **P2**：進階風險彙整卡（answer-tool 結構化 positives/risks/confidence/verdict）、鏈上/基本面、步驟狀態 data parts、來源 source parts。
- **後期**：影片/圖片多模態 RAG、深度鏈上、自選清單、async Server Component 的 Playwright E2E。

---

## Self-Review

- **Spec coverage**：F1 市場總覽(Task 2,7)、F2 個幣頁(Task 3,4,5,8)、F3 AI 問答(Task 11,12)、F4 知識庫 RAG(Task 9)、F5 數據紀錄 query_logs/feedback(Task 10,11,12)、graceful/不編造(http stale fallback + 各工具 + UI)、綠漲紅跌/來源時間戳、能力界定/免責(prompt + Chat)、Railway+Postgres 部署(Task 13)。
- **技術選型依據**：每個選型在「技術選型與依據」表與各 Task 內標註來源。
- **Placeholder scan**：無 TBD/TODO；每步附完整程式碼。**版本敏感處明確標「以實際匯出為準」並附驗證步驟**：`ai/test` Mock 類別名（Task 11）、OpenAI vector store API 名（Task 9 Step 1）。
- **Type consistency**：`ToolResult<T>` 貫穿；`cryptoTools` 3 工具名與測試一致；`runChat` 的 `sessionId`/`model` 與 route/測試對齊；`logQuery`/`recordFeedback` 欄位與 schema.sql 對齊；元件 props 與工具回傳型別一致。
- **已知覆蓋缺口**：Task 12 前端測試 mock 掉 `useChat`，只驗證靜態 UI（能力框/免責/chips），串流與按讚的實際行為靠 Task 11 後端測試 + 端到端手動驗證涵蓋。
