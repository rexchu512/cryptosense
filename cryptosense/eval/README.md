# 引用忠實度評測

回答「模型講的話，有幾成真的有來源支撐」以及「該說不知道的時候，有沒有說」。

## 執行

```bash
cd cryptosense
npx tsx --conditions=react-server eval/run-fidelity.mts

# 只跑一個 store、只跑幾題（試跑用）
npx tsx --conditions=react-server eval/run-fidelity.mts --only=new --ids=g01,n01,f01
npx tsx --conditions=react-server eval/run-fidelity.mts --only=old --limit=6
```

**`--conditions=react-server` 不能省。** 檢索模組掛了 `server-only` 保護，
沒有這個條件，Node 會直接丟「This module cannot be imported from a Client Component」。

結果寫在 `eval/results/fidelity-<時間戳>.json`，含每題的檢索片段、完整回答與逐句判定。

## 三個指標

| 指標 | 意思 |
|---|---|
| 句子支撐率 | 帶事實主張的句子中，能在檢索片段裡找到根據的比例 |
| 誠實拒答率 | 該說「知識庫沒有這項資料」的題目中，真的說了的比例 |
| 有編造事實的題數 | 出現「片段裡完全沒有的具體事實」或「張冠李戴」的題數 |

判定把三種問題分開記，不要混為一談：

- `unsupported_facts` — 編造具體事實（金額、日期、人名、地區）。**最嚴重。**
- `misattributed` — 事實在證據裡，但安錯對象。例如把 A 協議的損失寫成 B 協議的。
- `general_commentary` — 沒根據的一般性分析。單獨計數，不算編造。

分開的理由：第一版判定把系統提示詞規定的「結論：偏空，信心高」也算成編造，
數字會虛高，反而掩蓋真正危險的那種捏造。

## 題組怎麼來的

40 題，標籤依據 `corpus-ingest` 對 934 筆事故紀錄的實際盤點，不是憑印象：

| 類別 | 題數 | 期望行為 |
|---|---|---|
| grounded | 14 | 語料確定有，應該答得出來並標來源 |
| aggregate | 6 | 需要跨多個檔案彙整 |
| absent | 10 | 語料確定沒有（INJ、TIA、Chainlink、Uniswap 都是 0 筆），應明說沒資料 |
| false_premise | 10 | 題目本身夾帶假事實，看模型會不會順著編下去 |

`false_premise` 是最重要的一類。交接文件記載模型曾寫出「近期香港行情走弱」
——輸入資料完全沒提到香港，而且它還標了來源。這類題目就是在抓這種行為。

## 設計上的取捨（讀數字前要知道）

**只測知識庫這一條路徑。** 不讓行情與新聞工具參與，這樣分數變化才能歸因到
知識庫本身。代價是這不等於使用者實際看到的完整回答。

**每題都綁定對應的幣種情境。** 系統提示詞是綁定單一幣種的，情境不對的話模型會
用「超出範疇」擋掉問題 —— 那是範疇管制，不是誠實拒答，會把指標量成假的。

**判定模型比回答模型強一階**（`gpt-5.4` vs `gpt-5.4-mini`），避免同一個模型自己
評自己。但兩者仍是同一個供應商，自我偏好無法完全排除。
用 `EVAL_JUDGE_MODEL` 可以換掉判定模型。

## 兩個踩過的坑

**檢索失敗會偽裝成「查無資料」。** `searchKnowledgeBase` 出錯時回傳的是
「空結果 + error 欄位」，跟真的查不到長得一模一樣。實測有一題因此從 10 個片段
變成 0 個，支撐率被拉低 24 個百分點。現在會重試 4 次，並把「檢索故障」與
「查無資料」分開統計。

**store 是全域環境變數，不能兩個混在同一批並行跑。** `OPENAI_VECTOR_STORE_ID`
是 process 層級的，並行時兩個 store 的工作會互相覆蓋設定，整個新舊比較都會錯。
現在改成一個 store 完整跑完再換下一個。
