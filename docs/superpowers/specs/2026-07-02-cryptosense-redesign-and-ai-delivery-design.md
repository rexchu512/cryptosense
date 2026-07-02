# CryptoSense Redesign ＋ AI 回答資訊傳遞（Design Spec）

> **狀態**：已透過 visual companion 與使用者逐項確認（暖白亮色、無 emoji、真實幣種 icon、AI 面板暖白、結論先行不掛「BLUF」字樣、`$70K` 青色、三源引用回溯）。待轉 `writing-plans` 產實作計畫。
> **範圍**：`cryptosense/`。把 `framer/design-system-portfolio-site.md` 的視覺系統移植到 CryptoSense，並修復 AI 回答「資訊未消化」的 bug。**不新增 DB、不改變 AI 工具數量（仍 3 支）、不改資料來源。**
> **依據**：`framer/design-system-portfolio-site.md`（視覺 token 權威來源）＋ 本次四路調研（NN/g 資訊設計、專業金融工具 UX、前端渲染器、OpenAI file search/Responses API）＋ 既有 `DESIGN-v2-research-driven.md` 與 `2026-07-02-cryptosense-aggregator-ui-refresh-design.md`（不覆蓋，本文件為整合與增補）。
> **驗證方式**：所有函式庫/API 規格均以 context7 或官方文件一手核對（見 §11）；所有畫面以 Playwright cold-read 截圖驗證。

---

## 1. 動機（root cause 已驗證）

目前 UI 被評為「極醜」，AI 回答被評為「shit in shit out、行距像終端機」。systematic-debugging 查證出**三個獨立 root cause**：

1. **輸出層 — `prose` 是無效 class（最關鍵）**：`components/Markdown.tsx` 用 `react-markdown`＋`remark-gfm`（markdown 確實有被解析成 `<ul><h2><table>`），但外層 `className="prose prose-invert"` 中的 **`@tailwindcss/typography` 根本沒安裝**（不在 `package.json`、`globals.css` 也無 `@plugin`）。Tailwind v4 的 Preflight 又把 `ul/ol` 的 list-style、`h1–h6/p` 的 margin 全 reset → markdown 結構被視覺剝光成一坨。**前端有 render markdown，只是樣式被剝光。**
2. **行距像終端機**：`Chat.tsx` 用 `text-sm`＋預設緊 line-height，且整塊在 `bg-dark` 深色框，缺呼吸感。
3. **輸入層 — 系統提示**：`lib/ai/prompt.ts` 有「先結論、分點」，但（a）要求用 emoji `✅⚠️📰📚`（與 no-emoji 要求衝突）；（b）從未要求輸出真正的 **markdown**（清單/表格/`**粗體**`）；（c）無 `[n]` 引用協定。OpenAI 官方明載 GPT 預設不輸出 markdown、長對話會衰退，需顯式指示並每 3–5 輪重申。

**視覺層**：現況為 Coinbase 藍白 + 純黑/純白 AI console，與作品集設計系統（暖白 + 青綠 + 深靛藍）不一致。

---

## 2. 設計 Token（移植自作品集設計系統）

以 `:root` 放 primitive、`@theme inline` 放 semantic（Tailwind v4 官方模式）。**不覆寫 shadcn 既有 `--primary`/`--muted`**，沿用 `--cb-`/自訂命名空間。

| 語意 | 值（RGB / OKLCH） | 備註 |
|---|---|---|
| 頁面底 `--bg`/`--canvas` | `rgb(253,252,249)` | 暖白，非純白（減眩光） |
| 主文字 `--ink` | `rgb(23,28,36)` | |
| 次文字 `--mfg` | `rgb(82,88,100)` | |
| 主色（深靛藍）`--primary-ink` | `rgb(21,49,102)` | 標題/強調；**勿覆寫 shadcn --primary** |
| 品牌（青綠）`--brand` | `rgb(0,150,157)` | 互動/選中/logo；**不承載漲跌語意** |
| 品牌強調 `--brand-strong` | `rgb(0,117,131)` | 連結、引用號、青色 highlight |
| Brand Glow | `rgb(72,183,189)` | 低透明度光暈/hover/focus ring |
| 卡片 `--card` | `#fff` | |
| 柔面 `--soft`/`--muted` | `rgb(243,242,237)` | |
| 邊框 `--border` | `rgb(229,227,222)` | |
| 漲 `--up` | `rgb(14,138,95)`（壓飽和綠） | 與青綠品牌可區分 |
| 跌 `--down` | `rgb(194,72,64)`（壓飽和紅） | |
| 警示 `--warn` | `rgb(179,84,31)`（琥珀） | 謹慎使用；風險「highlight」改用青綠（見決策） |

- **字體**（`next/font/google`）：標題 `Plus Jakarta Sans`（cv03/cv04/cv09/cv11 via `font-feature-settings`）、內文 `Manrope`、資料/數字 `IBM Plex Mono`（tabular-nums）、中文 `Noto Sans TC`（**必須 `preload:false` 且不傳 `subsets:["latin"]`**，否則 build 噴 subset 錯）。基準 17px/1.85。
- **圓角**：卡片 `--rc:20px`、`--rl:16px`、pill `999px`。**陰影**：`--sh-sm`/`--sh-md`（柔和）。
- **容器**：`max-w:1440px`（閱讀欄 1180）、留白 52px（≤1000px→30px）。
- **玻璃導覽**：`backdrop-filter: blur(16px) saturate(140%)`＋`-webkit-` 前綴＋`@supports` fallback 退實心（背景不透明度 ~72% 保對比）。
- **動效**：reveal-on-scroll（IntersectionObserver，`'use client'`），CSS 只在 `@media(prefers-reduced-motion:no-preference)` 設 `opacity:0`（避免 JS 失敗永久隱形）。

## 3. 全站規則

1. **No-emoji（全站）**：移除所有 pictographic emoji（`📰💬😐✅⚠️📚` 等），改用 Lucide 風單色 SVG 或文字標籤。漲跌用 `▲▼` 單色排版符號（非彩色 emoji）＋正負號＋顏色（triple-encoding），可保留。系統提示同步移除 emoji 指令。
2. **真實幣種 icon**：一律用 CoinGecko API `image` 欄位（現況 `CoinIcon` 已支援）；roster = `coins/markets` 市值前 25（動態）。icon 放白底圓形 chip＋細框（處理透明/白色 logo）。
3. **語氣**：冷靜、中性、不擬人化、不報明牌、不給買賣指令、不保證獲利；數字只引用工具回傳值。

---

## 4. 資訊架構與導覽（P0 修死連結）

- 現況 `TopBar.tsx` 三個連結（市場/幣種/知識庫）全 `href="/"`＝死連結，違反 NN/g 資訊氣味「Sincere」原則。
- 修法：`市場總覽`→`/`；`幣種`→開全站搜尋（導向 `/coin/[id]`）；`知識庫`→**標「即將推出」disabled**（不承諾未兌現的連結）。
- 個幣頁加**麵包屑**「市場總覽 › BTC」（青綠僅套可點段）；全站僅 2 層，麵包屑作回上層錨點即可，不取代修死連結。
- 玻璃 sticky 導覽：logo（青綠圓點＋glow）＋ pill 連結 ＋ 全站搜尋（下拉帶真實 icon）；≤820px 收合為漢堡抽屜。

## 5. 頁面規格

### 5.1 市場總覽 `/`（倒金字塔儀表板）
- **Hero**：eyebrow「Market Pulse · 市場總覽」＋ H1「冷靜讀懂今天的市場」＋ 一句副述（anti-FOMO）。
- **KPI tiles ×4**：恐懼貪婪（**水平分段條＋marker，非半圓量表**——NN/g 反對 gauge）、總市值（Δ triple-encoded）、24H 量、BTC 主導（**百分比長條，非圓餅**）。
- **漲/跌幅榜**：每列真實 icon＋symbol＋name＋mini sparkline＋Δ%（triple-encoded）。
- **市值排行表**：欄位 `# / 幣種(icon+name+sym) / 價格 / 1H / 24H / 7D / 市值 / 7D 趨勢`；表頭 sticky 且可點排序（升降箭頭狀態指示）；排名變動 `▲n/▼n`；搜尋框置於表格上緣（NN/g：易發現）；數字右對齊 mono tabular-nums；淡斑馬紋＋hover；列高「寬鬆一級」。
- **響應式**：≤1000px 隱藏 1H/市值欄；≤640px 表格→卡片列（viewport 斷點；未來若嵌窄容器再用 container query）。
- **狀態**：loaded / loading（skeleton shimmer，尊重 reduced-motion）/ empty-error（冷靜可行動文案＋重載）。

### 5.2 個幣分析 `/coin/[id]`（兩欄工作台）
- 桌機 `grid: minmax(0,1fr) 380px`：**左＝分析、右＝AI console（sticky）**；≤1000px 堆疊（AI 落到分析下方）。
- 左欄：麵包屑 → 價格 hero（真實 icon＋大 mono 價格＋Δ triple-encoded）→ 4 格統計卡（排名/市值/24H量/流通量）→ 來源行（CoinGecko＋時間＋**Powered by CoinGecko API** 署名）→ **7D 趨勢圖**（recharts；標題**主動陳述發現**如「BTC 過去 7 日 +4.2%，波動度偏低」；端點直接標籤、極淡參考線、無 legend、單一強調色、area 漸層填充）→ 新聞列表。
- **狀態**：loaded / loading / not-found / news-error（新聞失敗但行情與 AI 仍可用）。
- **sticky 注意**：祖先鏈勿有 `overflow:hidden`；`top` = 導覽高；sidebar `h-[calc(100dvh-navH)] overflow-y-auto`。

---

## 6. AI Console 規格（暖白、右側停靠）

- **維持暖白卡片**（已確認），與全站一致；非深色。header：青綠圓點＋「AI 研究助手」＋「情境：{SYM}」chip＋展開全頁鈕。
- **訊息全寬、非泡泡**（tool framing；使用者訊息可右對齊深靛藍小標）。
- **Telemetry strip（誠實、非擬人化）**：`✓ 查行情  ✓ 檢索新聞  ✓ 查知識庫`（mono、進行中顯示 spinner），沿用現有 `isToolUIPart`/`getToolName`；**不寫「思考中…」**。
- **狀態**：
  - **首次/空**：一句能力範疇（NN/g guideline #3，具體非「問我任何事」）＋ 3 個建議 chips ＋ 免責一次。
  - **檢索中/串流**：telemetry ＋ 串流游標；**串流時不 auto-scroll 到底**（NN/g #7）。
  - **已回答**：見 §7、§9。
  - **錯誤/限流**：具體原因＋單一復原動作（「重試」），非通用「出錯了」。
- **composer**：底部停靠、全寬、Enter 送出（`isComposing` guard）、青綠漸層送出鈕。
- **免責只出現一次**（近 composer），**不每則重複**（現況重複兩次要移除）。

---

## 7. AI 回答資訊傳遞規格（倒金字塔 ＋ markdown ＋ 呼吸感）

**編排規則（NN/g，answer-first）**：
1. **結論先行**：第一段先給風險定調（偏多/中性/偏空 ＋ 信心 高/中/低），**不使用「BLUF」字樣**（可用「結論」標籤或直接粗體結論句）。
2. **可掃描**：`##` 小標題分段（正面觀點/風險與盲點/對照/來源）、`-` 清單、關鍵詞 `**粗體**`、一段一概念、短段落。
3. **表格用於比較**（如 BTC vs ETH：時間窗/量能）。
4. **複雜度對齊問題**：簡單問題簡答，不硬塞。
5. **`[n]` 行內引用**對應檢索來源（見 §9）。

**呼吸感 typography（scoped `.answer`，`@layer components`，`:where()` 0 特異度；採此路線而非 `prose`）**：
- 容器：`font-family: Manrope; font-size:17px; line-height:1.85; color:#26282d; max-width:68ch; text-wrap:pretty`。
- 段落 `p{margin:0 0 1.15em}`；首尾子元素 margin 歸零。
- 標題 `h2{font:700 1.34rem; color:--primary-ink; margin:1.5em 0 .55em}`（階層 h1 1.6/h3 1.14/h4 1rem）。
- 清單 `ul{list-style:disc;padding-left:1.4em}`、`li{margin:.42em 0;line-height:1.75}`、`li::marker{color:--brand}`；巢狀支援。
- 連結：`--brand-strong`＋underline-offset 2px；inline code：`--soft` 底＋細框；pre：深底 code 面；blockquote：左青綠邊條。
- 表格：`border-collapse`、`th` 底 2px、`td` 底 1px、`tbody tr:nth-child(even)` 斑馬紋、數字欄右對齊 mono；外層包 `overflow-x:auto`。
- 完整 CSS 已備妥（見附錄 A / frontend 調研報告），實作時直接落。

---

## 8. 串流 Markdown 渲染（Streamdown）

- **採用 Vercel `Streamdown`**（`/vercel/streamdown`，context7 確認）取代現有 `Markdown.tsx`：drop-in、內建 `remark-gfm`/`rehype-raw`/`rehype-katex`/`rehype-harden`、**內建處理串流未閉合 markdown（`parseIncompleteMarkdown`）**、**內建增量記憶化**。
- **移除現有對整包字串的 `memo(Markdown)`**（串流時每 token miss、無效）；Streamdown 內建 memo。
- **移除 `prose prose-invert`**（未裝 plugin，無效）；改套 §7 的 `.answer`（或用 Streamdown 預設樣式微調）。
- **Tailwind v4 設定**：`globals.css` 加 `@source "../node_modules/streamdown/dist/*.js";`；`import "streamdown/styles.css"`。
- **安全**：react-markdown v10/Streamdown 預設不渲染 raw HTML；**不加 `rehype-raw`**（除非日後需要並搭 `rehype-sanitize`）。
- **接法**：逐 `text` part 餵入 `<Streamdown className="answer" parseIncompleteMarkdown>`；`streaming` 狀態驅動游標。

## 9. 引用與來源回溯（三源統一）

三支工具共用 `ToolResult{ source, timestamp }`。建立**一套跨工具的 `[n]` 編號**，每個 `[n]` 對應一張「帶類型」來源卡：

| 工具 | 卡片 | 回溯 UI | 資料/AI SDK part |
|---|---|---|---|
| 行情 `getCoinData` | `[n] 行情 · CoinGecko · 快照時間` | 連 `coingecko.com/en/coins/{id}` ＋**Powered by CoinGecko API** 署名（免費 API **合規要求**） | `source-url` part |
| 新聞 `getCryptoNews` | `[n] 新聞 · 標題 · CoinTelegraph · 日期` | **連原文 URL**（RSS `link`） | `source-url` part |
| 知識庫 `searchKnowledgeBase` | `[n] 知識庫 · 檔名 · 段落 · 相似度` | **展開片段**（內部、無外部連結） | `source-document` part |

- **資料流**：`tools.ts` 回傳前替 chunk/來源加**穩定 1-based `n`**；用 AI SDK v5 `writer.write({type:'source', value:{sourceType:'url'|'document', id, url?, title}})` 串到前端；前端 `part.type==='source-url'|'source-document'` 渲染來源匣；答案 markdown 內 `[n]` 對應同一編號。
- **UI/UX**：類型徽章（行情/新聞/知識庫，顏色次要、有文字標籤 → NN/g 合規）；可連結者顯示外部箭頭、知識庫顯示「展開片段」；點 `[n]` scroll/highlight 對應卡。
- **架構註記**：因 file_search 目前包在子呼叫內，主模型看不到原生 `file_citation` annotations → `[n]` 一律以我方編號為準。模型**只有檢索到對應來源才標 `[n]`，禁止編造**。

## 10. 模型端修正（「shit in」）

- **系統提示改寫**（`lib/ai/prompt.ts`），接在「回答規範」處：
  - 用 Markdown 排版：結論先行（一句粗體結論，**不出現「BLUF」字樣**）→ `##` 小標題＋`-` 清單，比較用表格；避免長段。
  - 僅在語意正確處使用 markdown；代號/數字/欄位用反引號。
  - `[n]` 引用協定：知識庫每條關鍵判斷後標 `[n]`，對應檢索片段序號；末尾「## 來源」列出；**無對應片段不標、不編造**。
  - **移除所有 emoji**（改文字標籤）。
  - 氣質：冷靜、不擬人化、不報明牌、不保證獲利；數字只引用工具回傳。
- **長對話重申**（`lib/ai/chat.ts`）：每累積 3–5 則 user 訊息，於 system 尾端動態附加一行 markdown 格式提醒（OpenAI 官方建議）。
- **知識庫檢索升級（`lib/rag/fileSearch.ts`）**：由「file_search 生成呼叫當檢索、丟棄 text」改為 `client.vectorStores.search({query, max_num_results, ranking_options:{ranker,score_threshold}, filters})`（**純檢索、更省更快、可控**），加 `score_threshold` 濾雜訊，保留 `attributes`（日期/來源類型）供前端。回傳 `data[]{file_id,filename,score,content:[{type,text}]}`。

---

## 11. 函式庫/API 決策（context7 / 官方一手核對）

| 項目 | 決策 | 來源 |
|---|---|---|
| markdown 渲染 | **Streamdown**（drop-in，移除 memo/prose） | context7 `/vercel/streamdown` |
| 串流不完整 | `parseIncompleteMarkdown`（內建預設開） | 同上 |
| 引用資料流 | AI SDK v5 `source-url`/`source-document` part、`writer.write({type:'source'})` | context7 `/vercel/ai`（v5） |
| tool part 狀態 | `input-streaming/input-available/output-available/output-error`、`isToolUIPart` | 同上 |
| 知識庫檢索 | `vectorStores.search`（純檢索）＋`score_threshold` | OpenAI 官方 vector_stores/search |
| 呼吸感排版 | scoped `.answer :where(...)` @layer components（不用 prose-invert） | Tailwind Preflight 官方 |
| 字體 | next/font/google；Noto TC `preload:false` | Next font docs |
| 圖表 | 沿用 recharts（現有），改讀 CSS 變數＋area 漸層 | 專案現況 |
| CoinGecko 署名 | 免費 API 顯示「Powered by CoinGecko API」連 `/en/api` | CoinGecko attribution guide |
| 新聞來源 | CoinTelegraph RSS `link`/`pubDate`/`title`（RSS 2.0） | rssboard.org |

## 12. 測試考量（TDD ＋ e2e）

- **單元/元件**：`.answer` markdown 渲染出 `<ul><li>/<h2>/<table>`（不再是純文字）；telemetry 只在有 tool part 時出現；免責只出現一次；來源卡數量與 `[n]` 對應；no-emoji 斷言（回答與 UI 不含 pictographic emoji）；三種來源 part 各自渲染連結/展開。
- **e2e（Playwright，real）**：`user 送出問題 → 串流 → 出現結構化 markdown ＋ [n] ＋ 來源匣 → 點來源可回溯`；跨 desktop/tablet/mobile；loading/error/not-found 狀態；5x consecutive 0 flake。
- 型別擴充（KbChunk 加 `n`、source 型別）更新對應 `.test.ts`；`npm run typecheck` + `npm test` 每 task 跑。

## 13. 明確排除（避免蔓延）

- 不新增 DB、不加 watchlist、不加分類 tabs、不加 1D/1M/1Y 圖表時間窗、不加 trending 跑馬燈（FOMO）。
- 不改 AI 工具數量（仍 3 支）。
- 深色主題：先不做，但 token 架構預留（LCH/token 切換），暖白為預設。
- 語音輸入、對話存檔/分享（NN/g 有建議，列 P2）。

## 14. 已解決決策

- AI 對話面板：**暖白**（已確認）。
- 結論呈現：結論先行但**不出現「BLUF」字樣**。
- 風險 highlight 顏色：**青綠**（非琥珀）。

## 附錄 A：來源（References）

- NN/g：[Inverted Pyramid](https://www.nngroup.com/articles/inverted-pyramid/)、[How Users Read](https://www.nngroup.com/articles/how-users-read-on-the-web/)、[Text Scanning Patterns](https://www.nngroup.com/articles/text-scanning-patterns-eyetracking/)、[GenAI Write for the Web](https://www.nngroup.com/articles/genai-write-for-the-web/)、[AI Chatbots Guidelines](https://www.nngroup.com/articles/ai-chatbots-design-guidelines/)、[Dashboards Preattentive](https://www.nngroup.com/articles/dashboards-preattentive/)、[Data Tables](https://www.nngroup.com/articles/data-tables/)、[Information Scent](https://www.nngroup.com/articles/information-scent/)、[Better Link Labels](https://www.nngroup.com/articles/better-link-labels/)、[Progressive Disclosure](https://www.nngroup.com/articles/progressive-disclosure/)。
- 技術：[Streamdown](https://streamdown.ai)（context7 `/vercel/streamdown`）、[AI SDK v5](https://ai-sdk.dev)（context7 `/vercel/ai`）、[OpenAI vector store search](https://developers.openai.com/api/reference/resources/vector_stores/methods/search)、[OpenAI file search](https://developers.openai.com/api/docs/guides/tools-file-search)、[GPT-5 prompting guide](https://developers.openai.com/cookbook/examples/gpt-5/gpt-5_prompting_guide)、[Tailwind Preflight](https://tailwindcss.com/docs/preflight)、[@tailwindcss/typography](https://github.com/tailwindlabs/tailwindcss-typography)、[react-markdown](https://github.com/remarkjs/react-markdown)。
- 合規：[CoinGecko Attribution Guide](https://brand.coingecko.com/resources/attribution-guide)、[RSS 2.0](https://www.rssboard.org/rss-draft-1)。

## 附錄 B：完整 `.answer` CSS

> 見前端渲染調研報告（frontend agent）§4「呼吸感排版規格（可直接抄）」——含段落/標題/清單/連結/code/blockquote/表格/hr 的完整 `:where()` 規則，暖白版與深色 fallback。實作時原樣落入 `@layer components`。
