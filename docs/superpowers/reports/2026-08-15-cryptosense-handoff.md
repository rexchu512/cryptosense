# CryptoSense 交接文件

- **日期**：2026-08-15
- **給誰看**：接手 CryptoSense 的下一個工作階段
- **為什麼有這份文件**：前一個階段的對話快滿了，把狀態、決定與待辦交接出去

**讀完這份就能接手，不需要回頭問前一個階段。** 所有「為什麼」都寫在裡面，
目的是讓你不要重新討論已經定案的事。

---

## 1. 現況總覽

專案路徑：`cryptosense/`（Next.js 16 App Router + TypeScript + Vitest）

| 指標 | 狀態 |
|---|---|
| 測試 | **162 個、30 個檔案全綠**（本階段開始時是 87 個） |
| 型別檢查 | `npx tsc --noEmit` 乾淨 |
| Lint | 本階段新增/修改的檔案乾淨（專案其他既有檔案有 38 個既存錯誤，未處理） |
| 正式建置 | `npm run build` 成功 |
| 部署 | **尚未部署**，只在本機驗證過 |

實際執行模型：`OPENAI_MODEL=gpt-5.4-mini`（`.env.local`）。
向量庫：`OPENAI_VECTOR_STORE_ID=vs_6a36e6f050c88191a947e5faf8b99958`（Discord 語料）。

---

## 2. 本階段完成的工作

### 2.1 檢索層修正（已完成）

`lib/rag/fileSearch.ts`、`lib/ai/tools.ts`

- 取回片段數 **3 → 10**（官方上限 50，因語料仍髒故不拉滿）
- 開啟 `rewrite_query: true`（官方內建查詢改寫，先前預設關閉未用）
- 幣別帶法改為「問題在前、代號與 slug 在後」，不再把代號前綴進語意查詢
- 新增檢索記錄（分數與檔名），測試環境靜音
- 行情工具不再把 168 個走勢數字（`spark7d`）送進模型；
  **前端圖表仍需要它，所以是在工具邊界剝除，不是從 `getCoinData` 移除**

### 2.2 風險彙整卡（已完成）

規格：`docs/superpowers/specs/2026-08-15-cryptosense-risk-card-design.md`

| 檔案 | 職責 |
|---|---|
| `scripts/build-incidents.ts` | 從 DefiLlama 公開 API 產生事故索引；**內建金額單位斷言** |
| `lib/data/incidents.json` | 產出物，90 條鏈 / 562 個協議 / 360 KB |
| `lib/tools/incidents.ts` | 查表；`server-only`；查無資料回 `null` |
| `lib/i18n/incidentTerms.ts` | 攻擊手法的中文對照 |
| `lib/ai/riskCard.ts` | zod schema + 提示詞 + `streamRiskCard` |
| `lib/ai/riskCardStream.ts` | NDJSON 讀取，處理跨封包斷行 |
| `app/api/risk-card/route.ts` | `POST`，串流 `incidents → card* → done\|error` |
| `components/RiskCard.tsx` | 逐步渲染；失敗時整個不顯示 |
| `components/Chat.tsx` | 接線，卡片顯示於答案上方 |

### 2.3 新語料（已抓取，**尚未進向量庫**）

| 目錄 | 內容 | 量 |
|---|---|---|
| `rekt-corpus/` | rekt.news 逐案敘事報告 | 311 篇、4.0 MB |
| `defillama-corpus/` | DefiLlama 事故結構化記錄 | 623 份、380 KB |
| `yt-corpus/` | YouTube KOL 影片逐字稿 | 711 份、11.7 MB |
| `x-corpus/` | X 貼文（**已放棄，見 §4**） | 3 檔、6 KB |

爬蟲程式在 `crawl4ai-lab/`：`rekt_crawl.py`、`defillama_hacks.py`、
`yt_transcripts.py`、`x_crawl.py`、`social_login.py`、`social_profile.py`。

---

## 3. 已定案的決定（**請不要重新討論**）

這些都是使用者拍板或有實測數據支持的。重新討論會浪費他的時間。

| 決定 | 理由 |
|---|---|
| 知識庫定位：**只找特定幣**，不做方法論顧問 | 使用者選的 |
| **不擴增 Discord 語料**，改用新來源 | 使用者選的；且原語料 30% 是機器人推播 |
| 新語料＝**風險檔案＋資安事件** | 使用者選的 |
| 風險檔案（會變的數字）做成**即時工具**，不進知識庫 | 使用者選的；數字會過期 |
| **X 這條路放棄** | 實測每個幣只抓到 5–8 則，且高互動內容本身就是喊單 |
| **不自建向量庫**，繼續用 OpenAI File Search | 平台已內建混合檢索與重排序；清完語料後索引也塞得下 |
| P2 順序：風險卡 → K 線圖 → 資料庫 | 使用者選的 |
| 卡片不拆正規化資料表，整張存一個欄位 | 研究結論：加表面積不加技能展示 |
| Discord 舊語料**擱著不刪** | 刪除不可逆；BTC/ETH 上仍有真實深度 |

### 三個技術選型（有具體踩坑理由）

1. **K 線資料用 Binance，不用 CoinGecko。** CoinGecko 免費層拿不到 90 天日 K，
   會自動給 4 天一根，MA50/MA200 算不出來、RSI 週期會變成 56 天。
2. **指標用 `trading-signals`（已安裝 8.3.0），不用 `technicalindicators`。**
   後者停更六年，且**預設吐出來的 MACD 是 SMA 版本，是錯的**。
   `trading-signals` 零相依、RSI 預設就是 Wilder 平滑。
3. **K 線圖用 TradingView Lightweight Charts。** Recharts 沒有 K 線元件。
   注意：`next/dynamic` 的 `ssr:false` 在 Server Component 會直接報錯，
   要包一層 `'use client'` 的 shell。

**部署連帶影響：Binance 對美國 IP 回 451。** 服務要部署在新加坡區，
否則 K 線功能會整批失效，而且錯誤會被 try/catch 吃掉變成「暫無資料」。

---

## 4. 接下來要做的事（依優先序）

### 4.1 把新語料灌進向量庫（使用者已同意，等 YouTube 跑完，現在跑完了）

三批語料都帶了中繼資料標頭（來源、日期、協議、KOL 等），可直接掛成
vector store 的 `attributes`。

**OpenAI vector store 的能力邊界（官方文件確認）：**

- `attributes`：每檔最多 **16 個 key**，key ≤ 256 字元，值只能是字串或數字
- 過濾運算子：`eq` `ne` `gt` `gte` `lt` `lte` `in` `nin`，可用 `and` / `or` 巢狀
- **過濾在語意檢索「之前」執行**，之後才套用 `max_num_results` 與 `score_threshold`
- `max_num_results` 上限 50、預設 10
- `chunking_strategy`：`max_chunk_size_tokens` 100–4096（預設 800）、
  `chunk_overlap_tokens` ≤ 一半（預設 400）
- **屬性掛在「檔案」層級，不是 chunk 層級** → 想要細粒度過濾必須把大檔切小檔

單檔上限 **500 萬 tokens**。舊 Discord 語料裡那個 73.6 MB 的檔案幾乎確定超標，
**建議查一次 `vector_stores.files.list` 的 `status`**，可能它根本沒索引成功。

### 4.2 K 線圖與技術指標（P2 下一項，約 4–5 天）

研究把它跟兩支工具綁在一起：`getOHLCV` + `calcTechnicalSignals`。
價值在於「使用者有東西可以指著問」，直接推追問率（產品北極星）。

**七個計算陷阱**（實作時逐項確認）：

1. **暖機期**：RSI(14) 需 15 根；MACD 需 ≥34 根才有 signal 線。
   EMA 是遞迴的，要跟 TradingView 對得上得多灌 150–250 根。
   **規則：抓 250+ 根，只顯示最後 90 根。**
2. **Wilder 平滑 vs EMA**：RSI/ATR/ADX 用 Wilder（α=1/n），MACD 用 EMA（α=2/(n+1)）。
   搞混會得到「看起來對、其實錯」的數字。
3. **最後一根未收盤 K**：建議只用已收盤 K 計算，否則 RSI 會在 70/30 附近抖動。
4. **索引位移**：指標陣列比輸入短（暖機被丟掉）。
   **永遠用 timestamp join，不要用 index 對齊。**
5. **資料源一致性**：整張卡只能用一個來源，而且要標出來。
6. **時區**：Binance 日 K 邊界是 UTC。
7. **不要把指標當結論顯示**。「RSI 28 → 超賣」在法遵上等同買賣建議。

### 4.3 資料庫（P2 第三項，約 2–3 天）

只要三張表：`chat_sessions` / `messages` / `message_feedback`。

**關鍵細節（有踩坑理由）：**

- AI SDK v7 的持久化回呼是 **`onEnd`**，不是 `onFinish`（後者已標 deprecated）
- 訊息順序用**顯式 `seq` 欄位**，不要靠 timestamp（串流下同毫秒會並列）
- `parts[]` 存成 **jsonb 單欄**，不要正規化（每加一支工具就要一次 migration）
- 務必呼叫 `result.consumeStream()`（不要 await），否則瀏覽器斷線時
  `onEnd` 不會觸發，訊息進不了資料庫
- Railway 的 `DATABASE_URL` 是**池化**連線；
  **遷移、`CREATE INDEX CONCURRENTLY`、`SET` 一律要用 `DATABASE_UNPOOLED_URL`**
- 驅動用 `node-postgres`（`pg`），不要 `postgres.js`
  （後者預設開 prepared statements，會撞 Railway 的 transaction pooling）
- 遷移跑在 **Railway pre-deploy command**，不要在 app 啟動時 `migrate()`
- **90 天刪訊息時，回饋資料會跟著 cascade 消失。**
  必須先把 `prompt_version_id` / `model` / `coin_id` 反正規化到回饋表上

**如果要接 GA4，就必須跳 cookie 同意橫幅。** 自己在資料庫算北極星指標可以免橫幅。

### 4.4 未做但研究認為投報率最高的一項

**引用忠實度評測**：30–50 題黃金題組，量測「回答有幾成句子有來源支撐」、
「該拒答時有沒有拒答」。

研究的判斷是：這是幾乎沒有其他作品集會做、最能證明工程能力的一項。
**目前完全沒做。** 下面 §5 的第一個未解問題也需要它才能真正收斂。

---

## 5. 未解問題

### 5.1 條列文字的捏造（無結構性防護）

風險卡的數字與引用編號是用**結構**擋住的——模型想犯規也做不到。
但條列的文字是自由書寫，**內容捏造只能靠提示詞要求**。

實測時模型曾寫出「近期香港行情走弱」——輸入資料完全沒提到香港，而且它還標了來源。
加了「每條必須在分析內容裡找得到對應句子」之後，三次測試都沒再出現。

**但三次證明不了什麼。** 要真正收斂需要 §4.4 的固定題組。

### 5.2 `POST /api/risk-card` 客戶端回報 `net::ERR_ABORTED`

- 五次 e2e 測試中出現三次，時間點在第 15–24 秒
- **伺服器端 7/7 全部回 200**（處理時間 1.9–6.6 秒），無重複請求
- **卡片每一次都完整渲染**，沒有觀察到任何使用者可見影響
- 已測試並排除的兩個假設：
  1. Playwright 截圖注入 `caret-color`（12 次刻意搶時序，未重現）
  2. 腳本關閉瀏覽器太快（等待拉長到 25 秒仍出現）

**下一步**：在 `readRiskCardStream` 加臨時記錄，確認它是否讀到 `done` 訊號。

### 5.3 開發伺服器會退化成 HTTP 500（僅開發模式）

長時間使用後出現「Jest worker encountered 2 child process exceptions」，
個幣頁完全打不開，**只有重啟能救**。發生過兩次。不影響正式建置。

**如果開發到一半突然全部 500，先重啟伺服器再找 bug。**

### 5.4 手機上卡片高於對話視窗（使用者說暫時不用理）

卡片 646px，對話容器可見高度 448px。使用者已表示先不處理。

### 5.5 停止開發伺服器的陷阱

`TaskStop` 只會殺掉外層的 npm，`next dev` 本體會活著。
要用 `taskkill //PID <pid> //F`，或用 port 3000 找出 owning process。

---

## 6. 語料的實測數據（做決定時的依據）

舊 Discord 語料（476.3 MB、573 檔，**已在向量庫裡**）：

- **30% 是機器人推播**（新聞快訊、鯨魚警報），最大單檔 73.6 MB 是美股新聞機器人
- 前 10 檔佔 39.8%、前 20 檔佔 53.4%
- **語言以英文為主**（67.8% / 85.3% 純英文），不是中文
- 英中翻譯重複約 52 萬組
- **只有 10.8%–12.6% 的訊息提到任何幣**
- 舊匯出 61.6% 是 2024 年或更早

新語料對前 25 名幣種的事故覆蓋：**23/25**（僅 INJ、TIA 無資料）。

YouTube 只有三位 KOL 有字幕（Jayson Casper 640 支、提阿非羅 515 支、
罗晟Criss 24 支），實際成功率約六成。**其餘 KOL 一支都抓不到。**

---

## 7. 常用指令

```bash
cd cryptosense
npm test                              # 162 測試
npx tsc --noEmit                      # 型別
npm run build                         # 正式建置
npx tsx scripts/build-incidents.ts    # 重建事故索引（含金額單位斷言）

# 爬蟲（crawl4ai venv）
"C:/Users/user/.venvs/crawl4ai/Scripts/python.exe" rekt_crawl.py
python defillama_hacks.py             # 用系統 python
python yt_transcripts.py --kol "Jayson Casper,提阿非羅,罗晟Criss"
```

---

## 8. 使用者的工作方式（重要）

- **全程繁體中文**，台灣用語
- 不寫程式，但要為產品做決定 → 講功能語言，不要在主文塞程式碼
- **壞消息直說**，不要包裝
- 例行執行（跑腳本、抓公開網頁）直接做，不要停下來問
- 只有不可逆或對外的動作才需要確認
- 產出報告後**自動開啟**（`Start-Process`），不要只給路徑
- 交辦 Codex 的規格要含：目標／上下文／限制／完成標準，
  且完成標準必須是可勾選清單
- **時間壓力大**，範圍會不自覺擴張 —— 這是這個專案最大的風險，
  該收斂時要主動提出
