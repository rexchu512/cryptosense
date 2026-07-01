# CryptoSense — 聚合器導向 UI/UX 調整（Design Spec）

> **狀態**：已與使用者透過 visual companion（畫面比對）逐項確認，待使用者最終書面覆核後轉 `writing-plans` 產出 implementation plan。
> **範圍**：`cryptosense/`，延續 `feat/cryptosense-p1` 分支。**不新增 DB，不新增 AI 工具數量。**
> **依據**：現有 `cryptosense/DESIGN-v2-research-driven.md`（保留全部既有原則，本文件只新增/調整市場資料呈現的部分）＋ 本次 web 研究（NN/g 儀表板/表格準則、CoinGecko GLUE 使用者研究）＋ CoinMarketCap/CoinGecko 介面慣例。

## 1. 動機

`DESIGN-v2-research-driven.md` 已把 CryptoSense 定位成「分析工具」（Bloomberg/Linear/Perplexity 風），但使用者實際期待的部分心智模型來自「加密貨幣聚合器」（CoinMarketCap、CoinGecko）——搜尋、排名箭頭、多時間窗、幣種官方 logo 這些都是聚合器使用者的肌肉記憶，目前完全沒有。本次調整在**不破壞既有分析工具克制感**的前提下，補上這些聚合器慣例中確實有研究支持、且不需要新增後端能力的部分。

## 2. 研究依據摘要

| 來源 | 重點發現 | 落地方式 |
|---|---|---|
| NN/g《Dashboards: Making Charts and Graphs Easier to Understand》 | 折線圖優於圓餅/量表；顏色只做次要強化，不做唯一資訊載體 | 沿用既有 chart-line 規則於個幣頁新趨勢圖 |
| NN/g《8 Design Guidelines for Complex Applications》 | 專家使用者要能「一眼看到關鍵資訊」，用漸進揭露管理資訊量，而非全部攤平 | 個幣頁統計格用 4 格摘要，其餘留給 AI 問答 |
| NN/g 表格設計準則 | 搜尋/排序要放在明顯位置，不要藏在選單；表頭要看起來可點擊 | 市值表加搜尋框；表頭維持現有可點擊排序樣式 |
| CoinGecko GLUE（自家使用者研究） | 70% 使用者偏好「寬鬆」介面而非最大密度 | 市值表列高從純密集微調為「寬鬆一級」，而非維持 Bloomberg 級極密 |
| CoinMarketCap/CoinGecko 介面慣例 | 排名漲跌箭頭、1H/24H/7D 多時間窗、幣種官方 logo、movers 卡片帶 mini sparkline、全站搜尋 | 逐項納入，見第 3 節 |

**與現有 design.md 的張力與取捨**：CoinGecko 研究建議「寬鬆」，現有 design.md 主張「Bloomberg 密度是特徵不是缺陷」。本次取中間值——不改變資訊架構（仍是分析工具、非行銷頁），但市值表列高/內距略放寬一級，其餘密度特徵（sticky 表頭/首欄、等寬右對齊數字、斑馬紋）不變。

## 3. 各元件變更

### 3.1 市值排行表（`MarketDashboard.tsx`）
- 新增搜尋框（前端即時篩選目前已抓的清單，非新 API）。
- 新增排名變動箭頭（`▲1`/`▼1`/`–`）——用當次請求排序位置與上一次快取排序比較即可，不需新資料源。
- 24H 單欄改為 **1H / 24H / 7D** 三欄；同一支 `coins/markets` API 的 `price_change_percentage` 參數從 `24h` 改成 `1h,24h,7d` 即可取得，無新 API。
- 每列改用真實幣種 logo（CoinGecko `image` 欄位），取代現有純文字/emoji。
- 列高與內距從目前純密集，微調到「寬鬆一級」（padding 由 6px 提升到約 9-12px），其餘密度特徵不變。
- 排名數字（`#`）與代號文字（如 `BTC`）統一為次要層級灰色（`--muted`/`--body`），避免與幣種全名同層級搶視覺權重；品牌識別色只透過 logo 圖片呈現，不额外用顏色標記代號文字（維持 design.md「顏色只保留給漲跌與唯一強調色」的節制原則）。

### 3.2 漲跌幅榜（Dashboard 內 gainers/losers 區塊）
- 每列加真實幣種 logo + mini sparkline（沿用 7d 資料的縮圖版本），取代純文字列表。

### 3.3 頂部導覽列（`app/layout.tsx` 或共用 header 元件）
- 加一個全站搜尋輸入框，輸入幣名/代號可導向對應 `/coin/[id]`。
- 需新增一支唯讀函式呼叫 CoinGecko `/search` endpoint（無 DB、不算新增「AI 工具」，只是一般資料查詢函式，與 AI 問答的 3 支工具無關）。
- 不加 trending 跑馬燈（已確認排除，與「不做 FOMO/慢下來研究」原則衝突）。

### 3.4 個幣分析頁（`CoinDetail.tsx`）
- 加 4 格統計卡：市值排名、市值、24H 量、流通量。資料來自現有 `getCoinData` 呼叫即可補齊（CoinGecko 回應本來就有 `market_cap_rank`、`circulating_supply`），只需把欄位加進 `CoinData` 型別與對應 API 回應解析。
- 加放大版 7 日趨勢線圖：沿用現有 `spark7d` 資料，圖表標題採「主動陳述發現」（如「ETH 7 日下跌 0.8%，波動度偏低」），遵守既有 design.md 圖表規則（灰階/單一強調色、端點直接標籤、無圖例、無格線）。**只有 7D 一種時間窗**（1D/1M/1Y 需要額外呼叫 `market_chart` API，明確排除於本次範圍）。
- 個幣 logo 同步換成真實 CoinGecko `image`。

### 3.5 型別變更

```ts
// lib/tools/market.ts
export type MarketCoin = {
  id: string; symbol: string; name: string; image: string; marketCapRank: number;
  price: number; change1h: number; change24h: number; change7d: number;
  marketCap: number; spark7d: number[];
};

// lib/tools/coin.ts
export type CoinData = {
  id: string; symbol: string; name: string; image: string; marketCapRank: number;
  price: number; change24h: number; marketCap: number; volume24h: number; circulatingSupply: number;
};
```

### 3.6 新增唯讀查詢（非 AI 工具）

```ts
// lib/tools/search.ts（新檔案；不計入「剛好 3 支 AI 工具」，屬於一般前端資料查詢）
export type CoinSearchResult = { id: string; symbol: string; name: string; image: string };
export function searchCoins(query: string): Promise<ToolResult<CoinSearchResult[]>>
```

## 4. 明確排除（避免範圍蔓延）

- 分類篩選 tabs（DeFi/Layer1 等）——目前資料源沒有可靠分類欄位。
- Watchlist 星號追蹤——需要持久化（DB）才有意義，留給 P2。
- 圖表 1D/1M/1Y 時間窗切換——需要額外 `market_chart` API 呼叫，先只做 7D。
- 頂部 trending 跑馬燈——與現有設計原則（不做 FOMO/urgency）衝突，已否決。

## 5. 測試考量

- `market.ts`/`coin.ts` 的型別擴充需更新對應 `.test.ts`（新增 `image`/`marketCapRank`/`change1h`/`change7d` 欄位斷言）。
- `searchCoins` 需要新測試檔（成功映射、API 失敗回 `fail`，比照現有 `ToolResult` 慣例）。
- `MarketDashboard`/`CoinDetail` 元件測試需新增：搜尋框可過濾清單、排名箭頭正確方向、logo `<img>` 渲染、4 格統計卡數值正確、7 日趨勢圖標題文字。
- 沿用現有 TDD 流程（先寫失敗測試），`npm run typecheck` + `npm test` 每個 task 跑一次。

## 6. Self-Review

- **Placeholder scan**：無 TBD，型別與函式簽名皆為具體程式碼。
- **一致性**：新欄位（`image`/`marketCapRank`/`change1h`/`change7d`）與 `ToolResult<T>` 慣例一致；`searchCoins` 明確標註「非 AI 工具」，不影響 P1.x「剛好 3 支工具」的既有約束。
- **範圍**：聚焦視覺呈現 + 既有 API 欄位補齊 + 一支新的唯讀搜尋查詢，不涉及 DB、不涉及技術指標/K 線（P2 範圍），不新增 AI 工具數量。
- **與現有 design.md 的關係**：本文件是增補，不覆蓋；色彩節制、triple-encoding、圖表規則等既有原則全部沿用，僅新增市值表密度微調的取捨說明（第 2 節）。
