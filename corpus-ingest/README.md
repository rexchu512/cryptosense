# corpus-ingest

把語料灌進 OpenAI vector store 的工具。語料目錄在專案根目錄
（`rekt-corpus/`、`defillama-corpus/`、`yt-corpus/`），爬蟲程式在 `crawl4ai-lab/`。

金鑰讀 `cryptosense/.env.local` 的 `OPENAI_API_KEY`。腳本都用絕對路徑，
從任何工作目錄執行結果都一樣。

## 兩個 vector store

| 用途 | ID | 內容 |
|---|---|---|
| 舊（`.env.local` 目前指向這個） | `vs_6a36e6f050c88191a947e5faf8b99958` | Discord 語料，573 檔 / 936 MB |
| 新 | `vs_6a7ffbc3bd008191975c26293e32f8a4` | rekt + DefiLlama + YouTube，1645 檔 / 35.6 MB |

`upload-progress.json` 記錄新 store 的「磁碟路徑 → file_id」對照，
也是續傳與孤兒偵測的依據。**不要刪。**

## 常用指令

```bash
node corpus-ingest/corpus-dryrun.mjs      # 試跑：檢查標頭解析，不連網
node corpus-ingest/corpus-upload.mjs      # 上傳（可續傳，跳過已完成的）
node corpus-ingest/verify-store.mjs       # 驗收：數量/失敗/重複/孤兒/屬性
node corpus-ingest/requeue-stuck.mjs      # 重傳卡住或失敗的檔案（--dry 可試跑）
node corpus-ingest/remediate.mjs --dry    # 補屬性、刪重複（先試跑再實跑）
node corpus-ingest/inspect-anomalies.mjs  # 驗收沒過時查細節
node corpus-ingest/retrieval-smoke.mjs    # 新舊 store 檢索對照
node corpus-ingest/vs-status.mjs [id]     # 看任一個 store 的索引狀態

node corpus-ingest/date-test.mjs          # 日期正規化測試
node corpus-ingest/retry-gap-test.mjs     # 重試機制的重現測試
```

## 加新語料來源時

1. 在 `corpus-lib.mjs` 的 `CORPORA` 加一筆
2. 確認檔案開頭有 `# key: value` 標頭，而且一定要有 `# source:`
3. 跑 `corpus-dryrun.mjs`，問題清單要是空的才能往下
4. 跑 `corpus-upload.mjs`，再跑 `verify-store.mjs` 驗收

## 踩過的坑（重跑前先看）

**重試一定要包住 `fetch` 本身。** `fetch` 遇到網路層錯誤是「丟例外」不是「回錯誤碼」。
如果 `fetch` 寫在 try 外面，例外會直接穿過重試迴圈 —— 等於零重試。
實測：跑到第 1231 個檔案時網路抖一下，剩下 414 個在幾秒內全部失敗。
症狀會偽裝成「某個 KOL 的中文檔名全掛」，那是假線索。

**「上傳失敗」不等於伺服器沒收到。** 有 4 個檔案伺服器已建立關聯但回應沒傳回來，
重試就變成重複資料。所以 `verify-store.mjs` 會比對進度檔與 store 實際內容，
多出來的孤兒要刪。光看上傳器自己報的成功數不夠。

**標頭不保證是連續的 `# ` 行。** DefiLlama 有 2 個協議名稱含換行字元，
標題被拆成三行、中間夾空行，把標頭切成兩段。解析器改成掃描開頭 30 行收集所有
`# key: value`，不能遇到非 `#` 行就停。

**判斷重複不能只看 來源+標題+日期。** 同一個協議同一天可能有兩起不同事件
（Mirror 2021-10-08 有 200 萬和 9000 萬兩筆，攻擊手法也不同）。
要加上 `technique` 與 `loss_usd` 才分得出來。

**檔案會卡在 `in_progress` 而且不會變成 `failed`。** `last_error` 是 null，
不會自己好。用 `requeue-stuck.mjs` 刪掉重傳。

## 屬性設計

每個檔案都有 `source`（`rekt.news` / `defillama-hacks` / `youtube`）、`title`、
`date_num`。`date_num` 是統一後的數值 `YYYYMMDD`，因為三批來源的日期格式各不相同
（`06/22/2021`、`2025-12-11`、`20260225`，rekt 內部就有五種變體）。

OpenAI 的限制：每檔最多 16 個 key，值只能是字串／數字／布林。
過濾在語意檢索**之前**執行，之後才套用 `max_num_results` 與 `score_threshold`。
屬性掛在檔案層級不是 chunk 層級，所以想要細粒度過濾就得把大檔切小檔。
