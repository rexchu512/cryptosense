# CryptoSense AI 回答資訊傳遞 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修復 AI 回答「無 markdown 結構、行距像終端機、無出處編排、含 emoji」的 bug，讓回答結論先行、可掃描、有呼吸感，且行情/新聞/知識庫三源皆可回溯。

**Architecture:** 前端用 Vercel `Streamdown`（drop-in 取代現有無效的 `prose`+`memo` 包裝）＋ scoped `.answer` typography 還原被 Tailwind Preflight 清掉的結構樣式。後端在 `makeCryptoTools` 的 per-turn closure 放一個「來源註冊表」，三支工具共用一套 `[n]` 序號並寫進工具輸出；系統提示要求模型結論先行、輸出 markdown、依 `[n]` 引用、移除 emoji。知識庫檢索由「file_search 生成呼叫」升級為純檢索 `vectorStores.search`。前端從三支工具的 tool part 輸出組出統一來源匣。

**Tech Stack:** Next.js 16.2.9 (app router)、React 19、TypeScript、Tailwind CSS v4、Vercel AI SDK v5（`ai@7` + `@ai-sdk/react@4`，parts-based）、`openai@6`、`streamdown`、vitest。

## Global Constraints

- **AI 工具數量不變（剛好 3 支）**：`getCoinData` / `getCryptoNews` / `searchKnowledgeBase`。不新增工具。
- **No-emoji**：回答與 UI 一律不得含 pictographic emoji（`✅⚠️📰📚💬😐` 等）；用文字標籤或單色 SVG。`▲▼✓` 單色排版符號可用。
- **數字只能來自工具回傳**：模型不得自行推估數值。
- **不新增 DB**；不改資料來源（CoinGecko / CoinTelegraph RSS / OpenAI vector store）。
- **AI SDK 版本**：v5 parts-based API（`message.parts`、`isToolUIPart`、`getToolName`、`part.state`）。
- **Tailwind v4**：token 於 `@theme inline`；**不覆寫 shadcn `--primary`/`--muted`**。
- **TDD**：每個 task 先寫失敗測試 → 跑紅 → 實作 → 跑綠 → commit。`npm run typecheck` + `npm test` 每 task 跑。
- **暖白 AI 面板**（已確認）；`.answer` 用暖白版 CSS。
- **合規**：行情來源顯示「Powered by CoinGecko API」連 `https://www.coingecko.com/en/api`。

---

### Task 1: 載入字體（Manrope / Plus Jakarta Sans / Noto Sans TC）

**Files:**
- Modify: `cryptosense/app/layout.tsx`
- Modify: `cryptosense/app/globals.css:172-186`（`@layer base` 的 body/html 區）
- Test: `cryptosense/app/layout.test.tsx`

**Interfaces:**
- Produces: CSS 變數 `--font-sans`（Manrope）、`--font-heading`（Plus Jakarta Sans）、`--font-tc`（Noto Sans TC）、`--font-mono`（沿用 Geist Mono）掛在 `<html>`。

- [ ] **Step 1: Write the failing test**

```tsx
// app/layout.test.tsx
import { describe, it, expect } from "vitest";
import RootLayout from "./layout";

describe("RootLayout fonts", () => {
  it("attaches heading/sans/tc font variables to <html>", () => {
    const el = RootLayout({ children: null }) as any;
    const cls: string = el.props.className;
    expect(cls).toMatch(/--font-heading|font-heading/);
    expect(cls).toMatch(/--font-sans|font-sans/);
    expect(cls).toMatch(/--font-tc|font-tc/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd cryptosense && npx vitest run app/layout.test.tsx`
Expected: FAIL（目前只有 Inter/Geist_Mono，className 無 heading/tc 變數）。

- [ ] **Step 3: Write minimal implementation**

```tsx
// app/layout.tsx —— 取代現有 font 匯入
import type { Metadata } from "next";
import { Manrope, Plus_Jakarta_Sans, Noto_Sans_TC, Geist_Mono } from "next/font/google";
import { TopBar } from "@/components/TopBar";
import "./globals.css";

const sans = Manrope({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const heading = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-heading", display: "swap" });
// CJK：不可傳 subsets:["latin"]，且必須 preload:false，否則 build 期噴 subset 錯
const tc = Noto_Sans_TC({ variable: "--font-tc", display: "swap", preload: false });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "CryptoSense · 加密貨幣風險研究助手",
  description: "進場前的風險與盲點提醒：整合即時行情、新聞情緒與個人知識庫的 AI 研究助手。非投資建議。",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-Hant" className={`${sans.variable} ${heading.variable} ${tc.variable} ${mono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <TopBar />
        {children}
      </body>
    </html>
  );
}
```

在 `globals.css` 的 `@theme inline` 補 heading/tc（若尚未有）：`--font-heading: var(--font-heading);` `--font-tc: var(--font-tc);`。並把 `@layer base` 的 `body` 字體改成 `font-family: var(--font-sans), var(--font-tc), sans-serif;`、基準 `font-size:17px; line-height:1.85;`。

- [ ] **Step 4: Run test to verify it passes**

Run: `cd cryptosense && npx vitest run app/layout.test.tsx && npm run typecheck`
Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add cryptosense/app/layout.tsx cryptosense/app/globals.css cryptosense/app/layout.test.tsx
git commit -m "feat(fonts): load Manrope/Plus Jakarta/Noto TC via next/font"
```

---

### Task 2: 安裝 Streamdown 並設定 Tailwind v4 掃描

**Files:**
- Modify: `cryptosense/package.json`
- Modify: `cryptosense/app/globals.css:1-4`（`@import` 區）

**Interfaces:**
- Produces: 可用 `import { Streamdown } from "streamdown"`；Tailwind v4 掃描 Streamdown 內建樣式。

- [ ] **Step 1: 安裝依賴**

Run: `cd cryptosense && npm i streamdown`
Expected: `package.json` dependencies 出現 `streamdown`。

- [ ] **Step 2: 設定 Tailwind v4 `@source` 與樣式**

在 `globals.css` 最上方 `@import` 之後加：

```css
@source "../node_modules/streamdown/dist/*.js";
```

- [ ] **Step 3: 驗證可匯入**

Run: `cd cryptosense && node -e "require.resolve('streamdown')"`
Expected: 印出解析路徑、無錯誤。

- [ ] **Step 4: Commit**

```bash
git add cryptosense/package.json cryptosense/package-lock.json cryptosense/app/globals.css
git commit -m "chore: add streamdown + tailwind v4 @source"
```

---

### Task 3: `.answer` 呼吸感排版（scoped CSS，還原被 Preflight 清掉的結構）

**Files:**
- Modify: `cryptosense/app/globals.css`（新增 `@layer components` 區塊）
- Test: `cryptosense/app/globals.answer.test.ts`

**Interfaces:**
- Produces: `.answer` class，套在 markdown 容器上即有段距/清單/標題/表格樣式。

- [ ] **Step 1: Write the failing test**（以字串檢查 CSS 含關鍵規則）

```ts
// app/globals.answer.test.ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const css = readFileSync(resolve(__dirname, "globals.css"), "utf8");

describe(".answer typography", () => {
  it("restores list markers and breathing room", () => {
    expect(css).toMatch(/\.answer[\s\S]*line-height:\s*1\.85/);
    expect(css).toMatch(/\.answer :where\(ul\)[\s\S]*list-style:\s*disc/);
    expect(css).toMatch(/\.answer :where\(li::marker\)/);
    expect(css).toMatch(/\.answer :where\(table\)/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd cryptosense && npx vitest run app/globals.answer.test.ts`
Expected: FAIL（尚無 `.answer` 規則）。

- [ ] **Step 3: Write minimal implementation**（在 `globals.css` 末尾新增）

```css
@layer components {
  .answer{font-family:var(--font-sans),var(--font-tc),sans-serif;font-size:17px;line-height:1.85;color:#26282d;max-width:68ch;letter-spacing:.003em;text-wrap:pretty}
  .answer>:first-child{margin-top:0}
  .answer>:last-child{margin-bottom:0}
  .answer :where(p){margin:0 0 1.15em}
  .answer :where(h1,h2,h3,h4){font-family:var(--font-heading),var(--font-tc),sans-serif;font-weight:700;line-height:1.3;letter-spacing:-.011em;color:var(--ink);margin:1.6em 0 .55em}
  .answer :where(h1){font-size:1.6rem}
  .answer :where(h2){font-size:1.34rem;color:var(--cb-primary)}
  .answer :where(h3){font-size:1.14rem}
  .answer :where(h4){font-size:1rem}
  .answer :where(ul){list-style:disc;padding-left:1.4em;margin:0 0 1.15em}
  .answer :where(ol){list-style:decimal;padding-left:1.5em;margin:0 0 1.15em}
  .answer :where(li){margin:.42em 0;line-height:1.75;padding-left:.15em}
  .answer :where(li::marker){color:var(--cb-primary)}
  .answer :where(li>ul,li>ol){margin:.4em 0}
  .answer :where(a){color:var(--cb-primary);font-weight:500;text-decoration:underline;text-underline-offset:2px;text-decoration-thickness:1px}
  .answer :where(:not(pre)>code){font-family:var(--font-mono);font-size:.88em;background:var(--soft);border:1px solid var(--hairline-soft);padding:.12em .4em;border-radius:5px;white-space:break-spaces}
  .answer :where(pre){background:var(--dark);color:var(--on-dark);font-family:var(--font-mono);font-size:.9em;line-height:1.6;padding:1em 1.15em;border-radius:10px;overflow-x:auto;margin:1.3em 0}
  .answer :where(pre) code{background:none;border:0;padding:0}
  .answer :where(blockquote){border-left:3px solid var(--cb-primary);padding:.15em 0 .15em 1em;margin:1.3em 0;color:var(--body)}
  .answer :where(table){width:100%;border-collapse:collapse;font-size:.94em;margin:1.4em 0}
  .answer :where(th){text-align:left;font-weight:650;color:var(--ink);padding:.6em .9em;border-bottom:2px solid var(--hairline)}
  .answer :where(td){padding:.55em .9em;border-bottom:1px solid var(--hairline-soft)}
  .answer :where(tbody tr:nth-child(even)){background:var(--soft)}
  .answer :where(hr){border:0;border-top:1px solid var(--hairline);margin:2em 0}
  .answer :where(strong){font-weight:650;color:var(--ink)}
}
```

> 註：`--cb-primary` 需在 Task 8 由藍改青綠（見該任務）；此處引用即可。

- [ ] **Step 4: Run test to verify it passes**

Run: `cd cryptosense && npx vitest run app/globals.answer.test.ts`
Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add cryptosense/app/globals.css cryptosense/app/globals.answer.test.ts
git commit -m "feat(ui): scoped .answer typography with breathing room"
```

---

### Task 4: 用 Streamdown 取代 Markdown（移除無效 prose/memo）

**Files:**
- Modify: `cryptosense/components/Markdown.tsx`
- Test: `cryptosense/components/Markdown.test.tsx`

**Interfaces:**
- Consumes: `streamdown`（Task 2）、`.answer`（Task 3）。
- Produces: `<Markdown>{md}</Markdown>` 渲染出真正的 `<ul>/<h2>/<table>`，外層帶 `.answer`。

- [ ] **Step 1: Write the failing test**

```tsx
// components/Markdown.test.tsx
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Markdown } from "./Markdown";

describe("Markdown", () => {
  it("renders GFM structure (list, heading, table) inside .answer", () => {
    const md = "## 標題\n\n- 甲\n- 乙\n\n| a | b |\n|---|---|\n| 1 | 2 |";
    const { container } = render(<Markdown>{md}</Markdown>);
    expect(container.querySelector(".answer")).toBeTruthy();
    expect(container.querySelector("h2")).toBeTruthy();
    expect(container.querySelectorAll("li").length).toBe(2);
    expect(container.querySelector("table")).toBeTruthy();
  });
  it("does not double-wrap prose-invert (removed)", () => {
    const { container } = render(<Markdown>{"x"}</Markdown>);
    expect(container.querySelector(".prose-invert")).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd cryptosense && npx vitest run components/Markdown.test.tsx`
Expected: FAIL（現況有 `.prose-invert`，且無 `.answer`）。

- [ ] **Step 3: Write minimal implementation**

```tsx
// components/Markdown.tsx —— 整檔取代
"use client";
import { Streamdown } from "streamdown";

export function Markdown({ children }: { children: string }) {
  // Streamdown 內建 remark-gfm/rehype 與增量記憶化；移除舊的 memo() 與無效 prose。
  return (
    <Streamdown
      className="answer"
      parseIncompleteMarkdown
      components={{
        a: ({ href, children }) => (
          <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>
        ),
      }}
    >
      {children}
    </Streamdown>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd cryptosense && npx vitest run components/Markdown.test.tsx && npm run typecheck`
Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add cryptosense/components/Markdown.tsx cryptosense/components/Markdown.test.tsx
git commit -m "feat(chat): render markdown with Streamdown (drop prose/memo)"
```

---

### Task 5: 知識庫檢索升級為 `vectorStores.search`（純檢索 + score 門檻）

**Files:**
- Modify: `cryptosense/lib/rag/fileSearch.ts`
- Modify: `cryptosense/lib/rag/fileSearch.test.ts`

**Interfaces:**
- Produces: `searchKnowledgeBase(query, client?)` 回 `ToolResult<KbChunk[]>`；`KbChunk = { text; source; score? }`（型別不變）。

- [ ] **Step 1: Write the failing test**

```ts
// lib/rag/fileSearch.test.ts —— 新增/取代 client 形狀
import { describe, it, expect, vi } from "vitest";
import { searchKnowledgeBase } from "./fileSearch";

function fakeClient(data: any[]) {
  return { vectorStores: { search: vi.fn().mockResolvedValue({ data }) } } as any;
}

describe("searchKnowledgeBase (vectorStores.search)", () => {
  it("maps content[].text/filename/score and filters by threshold", async () => {
    process.env.OPENAI_VECTOR_STORE_ID = "vs_test";
    const client = fakeClient([
      { file_id: "f1", filename: "a.md", score: 0.9, content: [{ type: "text", text: "hi" }] },
      { file_id: "f2", filename: "b.md", score: 0.1, content: [{ type: "text", text: "lo" }] },
    ]);
    const res = await searchKnowledgeBase("q", client);
    expect(res.source).toBe("KnowledgeBase");
    expect(res.data?.map((c) => c.source)).toContain("a.md");
    // 0.1 < 0.35 門檻應被濾除
    expect(res.data?.every((c) => (c.score ?? 0) >= 0.35)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd cryptosense && npx vitest run lib/rag/fileSearch.test.ts`
Expected: FAIL（現況呼叫 `responses.create`，無 `vectorStores.search`）。

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/rag/fileSearch.ts —— 取代 searchKnowledgeBase 本體
import "server-only";
import OpenAI from "openai";
import { ok, fail } from "@/lib/tools/http";
import type { ToolResult } from "@/lib/tools/types";

export type KbChunk = { text: string; source: string; score?: number };

let _client: OpenAI | null = null;
function getClient(): Pick<OpenAI, "vectorStores"> {
  if (!_client) _client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _client;
}

const SCORE_THRESHOLD = 0.35;

export async function searchKnowledgeBase(
  query: string,
  client: Pick<OpenAI, "vectorStores"> = getClient(),
): Promise<ToolResult<KbChunk[]>> {
  const vsId = process.env.OPENAI_VECTOR_STORE_ID;
  if (!vsId) return fail("KnowledgeBase", "vector store not configured");
  try {
    const res: any = await client.vectorStores.search({
      vector_store_id: vsId,
      query,
      max_num_results: 5,
      ranking_options: { ranker: "auto", score_threshold: SCORE_THRESHOLD },
    } as any);
    const chunks: KbChunk[] = (res.data ?? [])
      .map((r: any) => ({
        text: (r.content ?? []).map((c: any) => c.text).join("\n"),
        source: r.filename ?? r.file_id ?? "knowledge-base",
        score: r.score,
      }))
      .filter((c: KbChunk) => (c.score ?? 0) >= SCORE_THRESHOLD);
    return ok(chunks, "KnowledgeBase");
  } catch (e: unknown) {
    return fail("KnowledgeBase", e instanceof Error ? e.message : String(e));
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd cryptosense && npx vitest run lib/rag/fileSearch.test.ts && npm run typecheck`
Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add cryptosense/lib/rag/fileSearch.ts cryptosense/lib/rag/fileSearch.test.ts
git commit -m "feat(rag): use vectorStores.search (pure retrieval + score threshold)"
```

---

### Task 6: Per-turn 來源註冊表 + 三工具統一 `[n]` 編號

**Files:**
- Create: `cryptosense/lib/ai/sources.ts`
- Create: `cryptosense/lib/ai/sources.test.ts`
- Modify: `cryptosense/lib/ai/tools.ts`
- Modify: `cryptosense/lib/ai/tools.test.ts`

**Interfaces:**
- Produces:
  - `type CitedSource = { n: number; kind: "market" | "news" | "kb"; title: string; url?: string; meta: string }`
  - `createSourceRegistry(): { add(s: Omit<CitedSource,"n">): CitedSource; list(): CitedSource[] }`
  - `makeCryptoTools(ctx, registry)` — 每支工具成功時把來源 `add` 進 registry，並把 `sources: CitedSource[]` 併入該工具輸出。

- [ ] **Step 1: Write the failing test（registry）**

```ts
// lib/ai/sources.test.ts
import { describe, it, expect } from "vitest";
import { createSourceRegistry } from "./sources";

describe("source registry", () => {
  it("assigns sequential 1-based n across kinds", () => {
    const r = createSourceRegistry();
    const a = r.add({ kind: "market", title: "BTC 快照", url: "https://x", meta: "CoinGecko" });
    const b = r.add({ kind: "news", title: "ETF", url: "https://y", meta: "CoinTelegraph" });
    const c = r.add({ kind: "kb", title: "note.md", meta: "段落 3" });
    expect([a.n, b.n, c.n]).toEqual([1, 2, 3]);
    expect(r.list().length).toBe(3);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd cryptosense && npx vitest run lib/ai/sources.test.ts`
Expected: FAIL（檔案不存在）。

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/ai/sources.ts
export type CitedSource = {
  n: number;
  kind: "market" | "news" | "kb";
  title: string;
  url?: string;
  meta: string; // 顯示用副述（來源+時間/段落）
};

export function createSourceRegistry() {
  const items: CitedSource[] = [];
  return {
    add(s: Omit<CitedSource, "n">): CitedSource {
      const cited = { n: items.length + 1, ...s };
      items.push(cited);
      return cited;
    },
    list(): CitedSource[] {
      return items;
    },
  };
}
```

- [ ] **Step 4: Write the failing test（tools 併入 sources）**

```ts
// lib/ai/tools.test.ts —— 追加
import { describe, it, expect, vi } from "vitest";
import { makeCryptoTools } from "./tools";
import { createSourceRegistry } from "./sources";

vi.mock("@/lib/tools/news", () => ({
  getCryptoNews: async () => ({
    data: [{ title: "ETF 淨流入", url: "https://ct/x", publishedAt: "2026-07-01" }],
    source: "CoinTelegraph", timestamp: "2026-07-02T15:30:00Z",
  }),
}));

describe("makeCryptoTools + registry", () => {
  it("news tool registers a numbered source and includes it in output", async () => {
    const reg = createSourceRegistry();
    const tools = makeCryptoTools({ coinId: "bitcoin", symbol: "BTC" }, reg);
    const out: any = await (tools.getCryptoNews as any).execute({}, {});
    expect(out.sources?.[0]?.n).toBe(1);
    expect(out.sources?.[0]?.kind).toBe("news");
    expect(reg.list()[0].url).toBe("https://ct/x");
  });
});
```

- [ ] **Step 5: Run test to verify it fails**

Run: `cd cryptosense && npx vitest run lib/ai/tools.test.ts`
Expected: FAIL（`makeCryptoTools` 尚未接受 registry / 未併 sources）。

- [ ] **Step 6: Write minimal implementation**

```ts
// lib/ai/tools.ts —— 取代整檔
import { tool } from "ai";
import { z } from "zod";
import { getCoinData } from "@/lib/tools/coin";
import { getCryptoNews } from "@/lib/tools/news";
import { searchKnowledgeBase } from "@/lib/rag/fileSearch";
import { fail } from "@/lib/tools/http";
import type { createSourceRegistry } from "./sources";

type Registry = ReturnType<typeof createSourceRegistry>;

export function makeCryptoTools(
  ctx: { coinId?: string; symbol?: string },
  registry?: Registry,
) {
  const reg = registry;
  return {
    getCoinData: tool({
      description: "取得幣的即時行情（價格/24h漲跌/市值/量）。省略 id 時取當前幣；可帶其他 id（如 bitcoin）做對照。",
      inputSchema: z.object({ id: z.string().optional().describe("CoinGecko id；省略=當前幣") }),
      execute: async ({ id }) => {
        const target = id ?? ctx.coinId;
        if (!target) return fail("CoinGecko", "no coin specified");
        const r = await getCoinData(target);
        if (r.data && reg) {
          const s = reg.add({
            kind: "market", title: `${r.data.name} 市場資料快照`,
            url: `https://www.coingecko.com/en/coins/${r.data.id}`,
            meta: `CoinGecko · ${r.timestamp} · Powered by CoinGecko API`,
          });
          return { ...r, sources: [s] };
        }
        return r;
      },
    }),
    getCryptoNews: tool({
      description: "取得近期加密新聞標題（總體 feed；情緒由你依標題判讀）。",
      inputSchema: z.object({}),
      execute: async () => {
        const r = await getCryptoNews(ctx.symbol);
        if (r.data && reg) {
          const sources = r.data.slice(0, 3).map((n) =>
            reg.add({ kind: "news", title: n.title, url: n.url, meta: `CoinTelegraph · ${n.publishedAt}` }),
          );
          return { ...r, sources };
        }
        return r;
      },
    }),
    searchKnowledgeBase: tool({
      description: "檢索使用者個人知識庫（自有筆記），回傳帶來源的片段；檢索以當前幣為標的。",
      inputSchema: z.object({ query: z.string() }),
      execute: async function* ({ query }) {
        yield { status: "searching" as const };
        const result = await searchKnowledgeBase(`${ctx.symbol ?? ""} ${query}`.trim());
        const sources = (result.data ?? []).map((c) =>
          reg ? reg.add({ kind: "kb" as const, title: c.source, meta: `個人筆記 · 相似度 ${(c.score ?? 0).toFixed(2)}` }) : null,
        ).filter(Boolean);
        yield { status: "done" as const, ...result, sources };
      },
    }),
  };
}
```

在 `lib/ai/chat.ts` 建立 registry 並傳入（保留現有 streamText 呼叫）：

```ts
// lib/ai/chat.ts —— 修改
import { createSourceRegistry } from "./sources";
// ...
export async function runChat({ messages, coinId, symbol, model }: { /* 同前 */ }) {
  const registry = createSourceRegistry();
  return streamText({
    model: model ?? openai(process.env.OPENAI_MODEL ?? "gpt-4o"),
    system: buildSystemPrompt({ coinId, symbol }),
    messages: await convertToModelMessages(messages),
    tools: makeCryptoTools({ coinId, symbol }, registry),
    stopWhen: stepCountIs(6),
  });
}
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `cd cryptosense && npx vitest run lib/ai/sources.test.ts lib/ai/tools.test.ts && npm run typecheck`
Expected: PASS。

- [ ] **Step 8: Commit**

```bash
git add cryptosense/lib/ai/sources.ts cryptosense/lib/ai/sources.test.ts cryptosense/lib/ai/tools.ts cryptosense/lib/ai/tools.test.ts cryptosense/lib/ai/chat.ts
git commit -m "feat(ai): per-turn source registry + unified [n] across 3 tools"
```

---

### Task 7: 重寫系統提示（結論先行 + 強制 markdown + [n] 引用 + 移除 emoji）

**Files:**
- Modify: `cryptosense/lib/ai/prompt.ts`
- Modify: `cryptosense/lib/ai/prompt.test.ts`

**Interfaces:**
- Produces: `buildSystemPrompt(ctx)` 回傳含 markdown/結論先行/`[n]` 引用/no-emoji 指令的字串。

- [ ] **Step 1: Write the failing test**

```ts
// lib/ai/prompt.test.ts —— 追加
import { describe, it, expect } from "vitest";
import { buildSystemPrompt } from "./prompt";

describe("buildSystemPrompt formatting rules", () => {
  const p = buildSystemPrompt({ coinId: "bitcoin", symbol: "BTC" });
  it("mandates markdown + conclusion-first + [n] citations", () => {
    expect(p).toMatch(/Markdown/);
    expect(p).toMatch(/結論/);
    expect(p).toMatch(/\[n\]/);
  });
  it("contains no pictographic emoji", () => {
    // 常見被用到的 emoji 不得出現
    expect(p).not.toMatch(/[✅⚠📰📚💬]/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd cryptosense && npx vitest run lib/ai/prompt.test.ts`
Expected: FAIL（現況含 `✅⚠️📰📚`、無 `[n]`/`Markdown`）。

- [ ] **Step 3: Write minimal implementation**（取代 `# 回答規範` 區塊）

```ts
// lib/ai/prompt.ts —— 取代「# 回答規範」整段為：
`# 回答規範（每次回答都必須遵守）
1. 用 Markdown 排版：第一行先給**結論**（風險定調：偏多／中性／偏空 ＋ 信心 高／中／低），其後用「## 小標題」與「- 清單」分段；比較正反面或多幣時用表格。避免整段長文。（不要出現「BLUF」字樣。）
2. 可掃描：關鍵詞用 **粗體**、一段一概念、短段落；代號／數字／欄位名用反引號標記。
3. 出處以 [n] 標註：工具回傳的 sources 陣列已帶 n（行情／新聞／知識庫共用一套編號）；每個關鍵判斷後標對應 [n]，回答末尾用「## 來源」不必自行重列（前端會渲染來源匣）。**沒有對應 sources 就不要標 [n]，也不要編造來源。**
4. 數字只能來自工具回傳，不得自行推估或補齊。
5. 不使用任何 emoji（如 ✅⚠️📰📚）；改用文字標籤（如「正面觀點」「風險與盲點」）。
6. 氣質：冷靜、中性、不擬人化、不報明牌、不給買賣指令、不保證獲利；不確定就說不確定。
7. 工具回傳 error 時，誠實說明該項資料暫時無法取得，不要編造。
8. 結尾附一次免責：「本內容為 AI 整理之公開資訊，非投資建議，請自行查證評估風險。」`
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd cryptosense && npx vitest run lib/ai/prompt.test.ts && npm run typecheck`
Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add cryptosense/lib/ai/prompt.ts cryptosense/lib/ai/prompt.test.ts
git commit -m "feat(ai): conclusion-first markdown prompt with [n] citations, no emoji"
```

---

### Task 8: 前端統一來源匣 + 移除重複免責 + 品牌色改青綠

**Files:**
- Create: `cryptosense/components/SourceTray.tsx`
- Create: `cryptosense/components/SourceTray.test.tsx`
- Modify: `cryptosense/components/Chat.tsx`
- Modify: `cryptosense/components/Chat.test.tsx`
- Modify: `cryptosense/app/globals.css`（`--cb-primary` 藍→青綠）

**Interfaces:**
- Consumes: 工具 part 輸出的 `sources: CitedSource[]`（Task 6）。
- Produces: `<SourceTray sources={CitedSource[]} />` 渲染三型來源（行情/新聞/知識庫），連結型顯示外部連結、kb 顯示「展開片段」。

- [ ] **Step 1: Write the failing test（SourceTray）**

```tsx
// components/SourceTray.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SourceTray } from "./SourceTray";

const sources = [
  { n: 1, kind: "kb", title: "note.md", meta: "個人筆記 · 相似度 0.82" },
  { n: 2, kind: "news", title: "ETF 淨流入", url: "https://ct/x", meta: "CoinTelegraph · 2026/07/01" },
  { n: 3, kind: "market", title: "BTC 快照", url: "https://www.coingecko.com/en/coins/bitcoin", meta: "CoinGecko · Powered by CoinGecko API" },
] as const;

describe("SourceTray", () => {
  it("renders each source with its number and external links for url sources", () => {
    render(<SourceTray sources={sources as any} />);
    expect(screen.getByText("note.md")).toBeTruthy();
    const links = screen.getAllByRole("link");
    expect(links.some((a) => a.getAttribute("href") === "https://ct/x")).toBe(true);
    // CoinGecko 合規署名
    expect(screen.getByText(/Powered by CoinGecko API/)).toBeTruthy();
  });
  it("returns null when empty", () => {
    const { container } = render(<SourceTray sources={[]} />);
    expect(container.firstChild).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd cryptosense && npx vitest run components/SourceTray.test.tsx`
Expected: FAIL（元件不存在）。

- [ ] **Step 3: Write minimal implementation**

```tsx
// components/SourceTray.tsx
import type { CitedSource } from "@/lib/ai/sources";

const BADGE: Record<CitedSource["kind"], string> = { market: "行情", news: "新聞", kb: "知識庫" };

export function SourceTray({ sources }: { sources: CitedSource[] }) {
  if (!sources || sources.length === 0) return null;
  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-hairline-soft">
      <div className="bg-muted px-3 py-2 text-[10px] uppercase tracking-wide text-cb-muted">
        來源 · {sources.length} 筆 · 每筆可回溯
      </div>
      {sources.map((s) => {
        const inner = (
          <>
            <span className="font-mono text-[11px] font-semibold text-brand-strong">[{s.n}]</span>
            <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-[9px] text-cb-muted">{BADGE[s.kind]}</span>
            <span className="min-w-0 flex-1">
              <span className="font-medium text-ink">{s.title}</span>
              <span className="mt-0.5 block text-[11px] text-cb-muted">{s.meta}</span>
            </span>
            {s.url ? <span aria-hidden className="text-cb-muted">↗</span> : <span className="text-[11px] text-brand-strong">展開片段</span>}
          </>
        );
        return s.url ? (
          <a key={s.n} href={s.url} target="_blank" rel="noopener noreferrer"
             className="flex items-center gap-2 border-t border-hairline-soft px-3 py-2.5 text-[12.5px] hover:bg-soft">
            {inner}
          </a>
        ) : (
          <div key={s.n} className="flex items-center gap-2 border-t border-hairline-soft px-3 py-2.5 text-[12.5px]">
            {inner}
          </div>
        );
      })}
    </div>
  );
}
```

> 註：`↗` 若視為 emoji 風險，改用 §12 設計系統的 external-link inline SVG（`viewBox='0 0 10 10'`）。此處 `↗`(U+2197) 為單色排版符號、非彩色 emoji，符合 no-emoji 規則。

- [ ] **Step 4: Write the failing test（Chat 整合：來源 + 免責只一次）**

```tsx
// components/Chat.test.tsx —— 追加（沿用現有 mock 慣例）
it("shows the disclaimer exactly once and renders sources from tool parts", () => {
  // 依現有 Chat.test.tsx 的 render 慣例組出一則 assistant 訊息，
  // 其 parts 含 tool-searchKnowledgeBase(output-available，output.sources=[{n:1,kind:'kb',title:'note.md',meta:'x'}])
  // 斷言：DISCLAIMER 文案在文件中只出現一次；畫面出現 "note.md"。
  // （具體 render 樣板複製自本檔既有測試的 helper。）
});
```

- [ ] **Step 5: Modify Chat.tsx**

- 移除訊息氣泡內、input 上「重複的第二個 DISCLAIMER」，只保留 composer 上方那一處。
- 收集所有工具 part 的 `output.sources`（`getCoinData`/`getCryptoNews`/`searchKnowledgeBase`），合併去重（by `n`）、依 `n` 排序，傳給 `<SourceTray>`，取代原 `CitationPanel`（或讓 CitationPanel 內部改用 SourceTray）。

```tsx
// components/Chat.tsx —— 於 assistant 分支：
import { SourceTray } from "./SourceTray";
import type { CitedSource } from "@/lib/ai/sources";

function allSources(parts: MsgPart[]): CitedSource[] {
  const acc: CitedSource[] = [];
  for (const p of parts) {
    if (isToolUIPart(p) && p.state === "output-available") {
      const out = (p as { output?: { sources?: CitedSource[] } }).output;
      if (out?.sources) acc.push(...out.sources);
    }
  }
  const seen = new Set<number>();
  return acc.filter((s) => (seen.has(s.n) ? false : (seen.add(s.n), true))).sort((a, b) => a.n - b.n);
}
// 在 assistant 區塊：<Markdown>{text}</Markdown> 之後改用
//   <SourceTray sources={allSources(parts)} />
// 並移除 input 上方那一段重複 DISCLAIMER（保留 composer 上方單一處）。
```

- [ ] **Step 6: 品牌色改青綠**（`globals.css`）

```css
/* :root 內 —— 由 Coinbase 藍改青綠 */
--cb-primary: #0d8d94;      /* 近 rgb(0,150,157) 青綠 */
--cb-primary-soft: #e2f1f2;
```

並新增 utility 對應（若尚未有 `--color-brand-strong`）：`@theme inline { --color-brand-strong: #007583; }`（供 `text-brand-strong` 使用）。

- [ ] **Step 7: Run tests to verify they pass**

Run: `cd cryptosense && npx vitest run components/SourceTray.test.tsx components/Chat.test.tsx && npm run typecheck && npm test`
Expected: 全數 PASS。

- [ ] **Step 8: Commit**

```bash
git add cryptosense/components/SourceTray.tsx cryptosense/components/SourceTray.test.tsx cryptosense/components/Chat.tsx cryptosense/components/Chat.test.tsx cryptosense/app/globals.css
git commit -m "feat(chat): unified 3-source citation tray, single disclaimer, teal brand"
```

---

### Task 9: 長對話每 3–5 輪重申 markdown 格式（OpenAI 官方建議）

**Files:**
- Modify: `cryptosense/lib/ai/chat.ts`
- Modify: `cryptosense/lib/ai/chat.test.ts`

**Interfaces:**
- Produces: `runChat` 在 user 訊息數為 3 的倍數時，於 system 尾端附加格式提醒。

- [ ] **Step 1: Write the failing test**

```ts
// lib/ai/chat.test.ts —— 追加（用可注入的 buildSystemPrompt 探針或攔截）
// 斷言：當 messages 含 3 則 user 訊息時，傳給 streamText 的 system 尾端含「Markdown」提醒字樣。
// 實作可將「組 system」抽成純函式 buildTurnSystem(messages, ctx) 便於測試：
import { describe, it, expect } from "vitest";
import { buildTurnSystem } from "./chat";

describe("buildTurnSystem markdown re-append", () => {
  it("appends a markdown reminder every 3rd user turn", () => {
    const three = Array.from({ length: 3 }, () => ({ role: "user", parts: [] }));
    const s = buildTurnSystem(three as any, { symbol: "BTC" });
    expect(s).toMatch(/提醒[\s\S]*Markdown/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd cryptosense && npx vitest run lib/ai/chat.test.ts`
Expected: FAIL（`buildTurnSystem` 不存在）。

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/ai/chat.ts —— 抽出並使用 buildTurnSystem
export function buildTurnSystem(messages: UIMessage[], ctx: { coinId?: string; symbol?: string }): string {
  const base = buildSystemPrompt(ctx);
  const userTurns = messages.filter((m) => m.role === "user").length;
  if (userTurns > 0 && userTurns % 3 === 0) {
    return base + "\n\n提醒：本輪回答仍必須使用上述 Markdown 結構（結論先行、清單/表格）與 [n] 引用格式。";
  }
  return base;
}
// 於 runChat 內：system: buildTurnSystem(messages, { coinId, symbol }),
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd cryptosense && npx vitest run lib/ai/chat.test.ts && npm run typecheck`
Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add cryptosense/lib/ai/chat.ts cryptosense/lib/ai/chat.test.ts
git commit -m "feat(ai): re-append markdown reminder every 3rd user turn"
```

---

### Task 10: e2e 驗證（real Playwright）

**Files:**
- Create: `cryptosense/e2e/ai-answer.spec.ts`（若專案尚無 e2e harness，於此 task 初始化最小 Playwright 設定）

**Interfaces:**
- Consumes: 完整 app（`npm run dev`）。

- [ ] **Step 1: 撰寫 e2e（先紅）**

情境（對真實 dev server、不 mock 自家 API）：
1. 開 `/coin/bitcoin`。
2. 在 AI composer 問「BTC 近 24H 風險？」送出。
3. 等待串流完成（telemetry 出現 `✓`）。
4. 斷言：回答容器 `.answer` 內存在 `<ul>` 或 `<h2>`（結構化，非純文字）。
5. 斷言：頁面存在「來源」匣，且至少一筆帶外部連結（`a[target=_blank]`）。
6. 斷言：`DISCLAIMER` 文案在該訊息區只出現一次。
7. 斷言：`.answer` 內不含 emoji（regex 掃 pictographic 範圍）。

```ts
// e2e/ai-answer.spec.ts（Playwright test 骨架）
import { test, expect } from "@playwright/test";

test("AI answer is structured, cited, breathing, emoji-free", async ({ page }) => {
  await page.goto("/coin/bitcoin");
  await page.getByPlaceholder(/繼續問關於/).fill("BTC 近 24H 風險？");
  await page.keyboard.press("Enter");
  await expect(page.locator(".answer ul, .answer h2").first()).toBeVisible({ timeout: 30000 });
  await expect(page.getByText(/來源/)).toBeVisible();
  await expect(page.locator('a[target="_blank"]').first()).toBeVisible();
  const discCount = await page.getByText(/非投資建議/).count();
  expect(discCount).toBe(1);
  const answerText = await page.locator(".answer").first().innerText();
  expect(answerText).not.toMatch(/[✅⚠📰📚💬]/);
});
```

- [ ] **Step 2: 跑 e2e 觀察真實行為**

Run: `cd cryptosense && npx playwright test e2e/ai-answer.spec.ts`
Expected: 首次可能因需真 API key/資料而調整；確保是「真跑通」而非 mock。連續 5 次 0 flake 才算綠。

- [ ] **Step 3: Commit**

```bash
git add cryptosense/e2e/ai-answer.spec.ts cryptosense/playwright.config.ts
git commit -m "test(e2e): AI answer structured/cited/emoji-free walk"
```

---

## Self-Review

**1. Spec coverage（對 §7–§11）：**
- §7 倒金字塔/呼吸感 → Task 3（.answer）＋ Task 7（prompt 結論先行）。✓
- §8 Streamdown 串流渲染 → Task 2 ＋ Task 4。✓
- §9 三源統一 [n] 引用 → Task 6（registry）＋ Task 8（SourceTray）。✓
- §10 模型端（prompt 改寫 + KB 升級 + 重申）→ Task 5、7、9。✓
- §3 no-emoji → Task 7（prompt）＋ Task 8/Task 10（UI 斷言）。✓
- CoinGecko 合規署名 → Task 6（meta）＋ Task 8（渲染 + 測試）。✓
- 字體 → Task 1。品牌青綠 → Task 8。✓
- **未涵蓋（刻意留給 Plan 2）**：整站視覺重設計（glass nav / IA 死連結 / 市場儀表板 / 個幣兩欄工作台 / 真實 icon 全面套用 / AI 面板改暖白外殼）。本 Plan 專注「回答內容的資訊傳遞」，AI 面板外殼配色沿用現況（`.answer` 已含深色 fallback 可用），視覺外殼於 Plan 2 統一處理。

**2. Placeholder scan：** Task 8 Step 4 / Task 10 的測試以「沿用既有測試 helper」描述而非完整貼出 render 樣板——實作時需複製 `Chat.test.tsx` 既有 helper；其餘步驟均有完整程式碼。

**3. Type consistency：** `CitedSource`（`sources.ts`）在 tools.ts / SourceTray.tsx / Chat.tsx 一致；`KbChunk` 型別不變；`makeCryptoTools(ctx, registry?)` 簽名於 chat.ts 一致。

---

## Execution Handoff

（見主對話：完成後選擇 Subagent-Driven 或 Inline Execution。）
