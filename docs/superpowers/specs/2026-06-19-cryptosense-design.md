# CryptoSense — 加密貨幣投資前 AI 風險研究助手｜設計文件

- **日期**：2026-06-19
- **狀態**：設計已確認，待撰寫實作計畫
- **類型**：個人學習 / 作品集專案

---

## 1. 產品定位與目標

幫散戶在「進場某個加密貨幣之前」，透過 AI 整合**技術面、新聞情緒、鏈上/基本面**三類資料，主動點出他可能忽略的**風險與盲點**，並提供正反觀點與資料來源，協助自行判斷。

- **定位**：加密貨幣綜合研究助手（整合行情/新聞/技術/鏈上的查詢＋問答），以「風險彙整/盲點提醒」為差異化亮點。
- **明確不做**：不報明牌、不給「該買/該賣」的明確買賣指令、不保證獲利。所有輸出皆附免責。
- **目標**：個人學習 / 作品集。務實取向——跑得起來、畫面漂亮、能展示 AI 能力；不需帳號、金流、企業級健壯度。
- **市場**：加密貨幣（非台股/美股）。

### 非目標（YAGNI）
- 不做使用者帳號、登入、金流、付費牆。
- 不做自動下單 / 連接交易所帳戶交易。
- 不做模型微調（fine-tuning）；自有資料一律走 RAG。
- 不在 MVP 做影片/圖片多模態、深度鏈上（鯨魚追蹤等）、自選清單。

---

## 2. 技術棧

| 層 | 選型 |
|----|------|
| 框架 | Next.js 14+（App Router）+ TypeScript，單一 repo，部署 Vercel |
| UI | Tailwind CSS + shadcn/ui；圖表用 lightweight-charts 或 Recharts |
| LLM | **OpenAI API**（function calling + streaming），使用支援 function calling 的最新模型（GPT-4o / GPT-4.1 class） |
| 技術指標 | `technicalindicators`（JS，本地計算） |
| RAG | OpenAI Embeddings + 本地檔案型向量庫（LanceDB 或純檔案 + 餘弦相似度）|

### 架構決策（方案 A：Next.js + OpenAI Tool-Use）
- 單一程式碼庫，API route 呼叫 OpenAI，把「抓行情/新聞、算技術指標、查鏈上、檢索知識庫」做成 OpenAI 的 **tools**。OpenAI 依問題自行決定呼叫哪些工具，拿到資料後彙整成結構化風險回答。
- 不採用 Python LangGraph 多 agent（對學習專案過度工程、需維護兩個服務）。
- 不採用排程預計算（需資料庫＋排程基礎建設，複雜度沒省到）。

### 降幻覺三原則（貫穿設計）
1. 所有數字一律由工具即時抓/算，**不靠 LLM 記憶**。
2. 每個判斷都附**資料來源與時間戳**。
3. **數字交給程式算，解讀才交給 LLM**。

---

## 3. 系統架構

```
Next.js (App Router, TypeScript) — 單一 repo，部署 Vercel
├── app/
│   ├── page.tsx              # 市場總覽 Dashboard
│   ├── coin/[id]/page.tsx    # 個幣分析頁
│   └── api/
│       ├── market/route.ts       # 市場總覽資料
│       ├── coin/[id]/route.ts    # 個幣四面向資料
│       └── chat/route.ts         # OpenAI function calling + streaming
├── lib/
│   ├── tools/                # 各資料工具（包成 OpenAI tools）
│   ├── rag/                  # ingestion 腳本 + 檢索
│   └── ai/                   # OpenAI client + 工具定義 + 風險彙整 prompt
├── components/               # UI 元件（風險卡、區塊、聊天）
└── scripts/ingest.ts         # 離線匯入自有資料到向量庫
```

### 模組邊界（可獨立理解/測試）
- **資料工具層 `lib/tools/`**：每個工具是純函式，輸入參數→輸出 `{ data, source, timestamp }`。可獨立測試（mock API）。
- **RAG 層 `lib/rag/`**：ingestion（離線）與 retrieval（即時）分離。retrieval 輸入 query→輸出帶來源的片段。
- **AI 層 `lib/ai/`**：定義工具 schema、組裝 OpenAI 呼叫、風險彙整 prompt、串流。
- **UI 元件 `components/`**：純展示，吃結構化資料，不含資料抓取邏輯。

---

## 4. 資料來源與工具（OpenAI tools）

全部使用免費/公開 API。每個工具回傳都帶 `source` 與 `timestamp`。

| 工具 | 資料來源（免費） | 用途 |
|------|----------------|------|
| `getMarketOverview` | CoinGecko 免費版 | 市值排行、漲跌榜、總市值、24h 量、BTC 主導率 |
| `getFearGreedIndex` | Alternative.me F&G API | 市場恐懼貪婪指數 |
| `getCoinData` | CoinGecko | 個幣價格、市值、成交量、流通量 |
| `getOHLCV` | CoinGecko / Binance 公開 API | K 線歷史（餵技術指標） |
| `calcTechnicalSignals` | 本地（`technicalindicators`） | RSI、MACD、均線、波動率 → 訊號表 |
| `getCryptoNews` | CryptoPanic 免費 API / RSS | 近期新聞標題＋連結 |
| `analyzeSentiment` | OpenAI | 對新聞做正/負面情緒判斷 |
| `getOnChainBasics` | CoinGecko（社群/開發者指標）＋ tokenomics | 供給、活躍度等基本面 |
| `searchKnowledgeBase` | 自有 RAG 向量庫 | 檢索自有對話/筆記並引用 |

### 錯誤處理
- API 失敗 → graceful failure：明確回傳「此項資料暫時取不到」，**不得編造**。AI 回答時須誠實標示缺漏。
- 免費 API 速率限制 → 加簡單快取（記憶體 / 短期 TTL）避免超量。
- 鏈上深度數據（鯨魚動向等）免費來源有限：MVP 僅做 CoinGecko 可得的基本面，深度鏈上列後期。

---

## 5. AI 問答層

### 流程（/api/chat）
```
使用者問「我該進場 ETH 嗎？」
  → 帶入情境（目前在看的 coinId）
  → OpenAI function calling 判斷要呼叫哪些工具
  → 平行抓：行情 + 技術訊號 + 新聞情緒 + 鏈上 + searchKnowledgeBase
  → OpenAI 彙整成「結構化風險回答」
  → streaming 回前端（邊生成邊顯示）
```

### 風險彙整輸出格式（結構化）
```
風險定調：⚠️ 中高風險（信心：高/中/低）
✅ 正面觀點：[2-3 點，每點附來源]
⚠️ 風險/盲點：[2-3 點，每點附來源]   ← 核心目的
📊 技術面：[訊號摘要]
📰 新聞情緒：[正/負面，附來源]
⚖️ 免責：本內容為 AI 整理之公開資訊，非投資建議，請自行查證評估
```

- 信心用**高/中/低標籤**，不用假精確百分比。
- 知識庫來源標示 📚，與公開資料來源視覺區隔。

---

## 6. RAG 知識庫

```
自有資料（文字對話/筆記為主）
  → scripts/ingest.ts（離線跑一次，可重跑更新）
  → 切塊 chunking + 標註來源/日期
  → OpenAI Embeddings 轉向量
  → 存入本地檔案型向量庫

查詢：searchKnowledgeBase(query) → 餘弦相似度檢索 → 帶來源片段
```

- ingestion（離線）與查詢（即時 API）分離。
- 檢索結果明確標示「來自你的知識庫」。
- **後期階段**：影片 → Whisper 轉逐字稿；圖片 → OpenAI Vision 描述/OCR；皆進同一向量庫。

---

## 7. UI/UX（套用 NNgroup 研究準則）

通用準則：above the fold 只放最關鍵資訊、漸進揭露最多兩層、狀態用「圖示＋文字＋顏色」三重編碼、**加密貨幣慣例綠漲紅跌且全站統一**、禁圓餅圖/3D、每個數字附對比基準與來源時間戳。

### 畫面一：市場總覽 Dashboard 〔採方向 B — KPI 儀表板〕
- 頂部四個等大 KPI 方塊：恐懼貪婪指數、總市值、24h 量、BTC 主導率。
- 中間漲幅榜 / 跌幅榜並排。
- 下方全寬市值排行表（含 7d 走勢迷你圖）。
- 點任一幣 → 進個幣分析頁。

### 畫面二：個幣分析頁
- 標頭：幣名、價格、24h 漲跌、資料更新時間。
- **風險彙整卡**（最上，倒金字塔先給結論）：風險定調徽章 ＋ AI 信心標籤 ＋ 左「正面觀點」右「風險/盲點」（各點掛來源）＋ 底部情境式免責。
- 四個可展開區塊（漸進揭露）：技術面 / 新聞情緒 / 鏈上基本面 / 你的知識庫（RAG，紫色標示區隔）。
- 最下方 CTA：一鍵針對此幣問 AI。

### 畫面三：AI 問答介面
- 開場明確界定能力（非「問我任何事」）＋標明「AI 生成、非投資建議」。
- 串流顯示步驟狀態：擷取行情 → 算指標 → 檢索新聞 → 查知識庫 → 彙整中。
- 回答先給結論（倒金字塔）：頂部風險定調徽章＋信心標籤；正反分點、每點掛來源。
- 情境化追問按鈕（下行風險 / 跟 X 比較 / 最新利空 / 鏈上細節）。
- 免責放在每則判斷的決策點（回答底部），不擬人化確定語氣。

> Mockup 參考：`.superpowers/brainstorm/`（market-dashboard-layout、coin-detail、chat-interface）

---

## 8. 法規與免責

- 加密貨幣不適用台灣《證券投資信託及顧問法》對「有價證券」之規範，但仍採保守路線：**提供風險資訊與一般性分析，不推介特定標的買賣、不保證獲利**。
- 全程顯著免責；採「情境式免責」（放決策點），而非到處貼被忽略的小字。
- 採研究結論的「給材料不給結論」路線：列出風險與正反觀點，由使用者自行判斷。

---

## 9. MVP 階段拆分（時間壓力下，每階段可獨立 demo）

| 階段 | 內容 | 可展示成果 |
|------|------|-----------|
| **P1（核心）** | 市場總覽 Dashboard（方向 B）+ 個幣頁（行情/技術/新聞）+ AI 問答（function calling，先不含 RAG） | 完整可用的 AI 研究助手 |
| **P2** | 風險彙整卡 + 鏈上基本面 + 信心標籤/來源呈現 | 差異化的「風險盲點」亮點 |
| **P3** | RAG 知識庫（自有文字對話資料） | 個人化、引用自有資料 |
| **後期** | 影片/圖片多模態、深度鏈上、自選清單 | 加分項 |

時間緊時，P1 即為可完整 demo 的作品；P2/P3 為差異化關鍵。

---

## 10. 測試策略

- **資料工具層**：單元測試，mock 外部 API，驗證回傳結構含 `source`/`timestamp`、錯誤時 graceful。
- **技術指標計算**：以已知輸入驗證 RSI/MACD/均線輸出正確（純函式好測）。
- **RAG 檢索**：以小型固定語料驗證檢索相關性與來源標註。
- **AI 層**：驗證工具 schema 正確、串流可運作、輸出含免責；可用錄製的 OpenAI 回應做整合測試。
- **UI**：關鍵元件（風險卡、聊天）渲染測試；綠漲紅跌與來源時間戳正確顯示。
```
