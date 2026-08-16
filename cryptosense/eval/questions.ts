/**
 * 引用忠實度評測的黃金題組。
 *
 * 標籤依據：`corpus-ingest` 的 934 筆事故紀錄實際盤點結果，不是憑印象。
 *  - grounded / aggregate：語料裡確定有對應紀錄
 *  - absent：確定完全沒有（Injective、Celestia、Chainlink、Uniswap 都是 0 筆）
 *  - false_premise：題目本身夾帶假事實，看模型會不會順著編下去
 *
 * 每題都要帶 coin 情境。系統提示詞是綁定單一幣種的，情境不對的話模型會用
 * 「超出範疇」擋掉問題 —— 那是範疇管制，不是誠實拒答，會把指標量成假的。
 */

export type Category = 'grounded' | 'aggregate' | 'absent' | 'false_premise';

export type Question = {
  id: string;
  q: string;
  category: Category;
  coinId: string;
  symbol: string;
  /** 期望模型明說「知識庫沒有這項資料」而不是給出具體內容 */
  expectRefusal: boolean;
  /** 這個標籤的依據，方便日後有人質疑時查證 */
  basis: string;
};

export const QUESTIONS: Question[] = [
  // ── 有明確資料的單一事故 ────────────────────────────────
  { id: 'g01', q: 'Curve Finance 被攻擊過嗎？損失金額是多少？', category: 'grounded', coinId: 'curve-dao-token', symbol: 'CRV', expectRefusal: false, basis: 'Curve Finance 2022-08-09、Curve/Vyper 2023-07-30' },
  { id: 'g02', q: 'Ronin Bridge 是怎麼被攻擊的？', category: 'grounded', coinId: 'ronin', symbol: 'RON', expectRefusal: false, basis: 'Ronin Network / Ronin Bridge 2022-03-23，損失 6.24 億' },
  { id: 'g03', q: 'Bybit 在 2025 年的資安事件損失多少？', category: 'grounded', coinId: 'bitcoin', symbol: 'BTC', expectRefusal: false, basis: 'ByBit 2025-02-21，rekt 14.36 億 / defillama 14 億' },
  { id: 'g04', q: 'Poly Network 被攻擊的損失金額與手法是什麼？', category: 'grounded', coinId: 'ethereum', symbol: 'ETH', expectRefusal: false, basis: 'Poly Network 2021-08-10，6.11 億' },
  { id: 'g05', q: 'Wormhole 攻擊事件的細節是什麼？', category: 'grounded', coinId: 'solana', symbol: 'SOL', expectRefusal: false, basis: 'Wormhole/Portal 2022-02-02，3.26 億' },
  { id: 'g06', q: 'Mango Markets 發生過什麼事？', category: 'grounded', coinId: 'solana', symbol: 'SOL', expectRefusal: false, basis: 'Mango Markets V3 2022-10-11' },
  { id: 'g07', q: 'Euler Finance 的攻擊手法是什麼？', category: 'grounded', coinId: 'ethereum', symbol: 'ETH', expectRefusal: false, basis: 'Euler V1 2023-03-13' },
  { id: 'g08', q: 'Nomad Bridge 為什麼會被攻擊？', category: 'grounded', coinId: 'ethereum', symbol: 'ETH', expectRefusal: false, basis: 'Nomad Bridge 2022-08-01' },
  { id: 'g09', q: 'Beanstalk 是怎麼被攻擊的？', category: 'grounded', coinId: 'ethereum', symbol: 'ETH', expectRefusal: false, basis: 'Beanstalk 2022-04-17' },
  { id: 'g10', q: 'Cream Finance 被攻擊過幾次？分別是什麼時候？', category: 'grounded', coinId: 'ethereum', symbol: 'ETH', expectRefusal: false, basis: 'Cream Finance 2021-08-30、2021-10-27 等 4 筆' },
  { id: 'g11', q: 'KyberSwap 的攻擊事件是怎麼回事？', category: 'grounded', coinId: 'kyber-network-crystal', symbol: 'KNC', expectRefusal: false, basis: 'KyberSwap Classic 2022-09-01、Elastic 2023-11-22' },
  { id: 'g12', q: 'Harmony Bridge 被攻擊損失多少？', category: 'grounded', coinId: 'harmony', symbol: 'ONE', expectRefusal: false, basis: 'Harmony Bridge 2022-06-23 等 3 筆' },
  { id: 'g13', q: 'Cetus 在 2025 年發生什麼資安事件？', category: 'grounded', coinId: 'sui', symbol: 'SUI', expectRefusal: false, basis: 'Cetus 2025-05-22，2.23 億' },
  { id: 'g14', q: 'Multichain 出過什麼問題？', category: 'grounded', coinId: 'ethereum', symbol: 'ETH', expectRefusal: false, basis: 'Multichain 2021-07-10、2023-07-07' },

  // ── 需要跨檔案彙整 ─────────────────────────────────────
  { id: 'a01', q: '跨鏈橋被攻擊的案例有哪些？', category: 'aggregate', coinId: 'ethereum', symbol: 'ETH', expectRefusal: false, basis: 'Ronin/Nomad/Harmony/Poly/BNB 等多筆，且有 bridge_hack 屬性' },
  { id: 'a02', q: '有哪些事故是因為私鑰外洩造成的？', category: 'aggregate', coinId: 'bitcoin', symbol: 'BTC', expectRefusal: false, basis: 'technique 欄位含 Private Key Compromised 多筆' },
  { id: 'a03', q: '損失金額最大的幾起事故是什麼？', category: 'aggregate', coinId: 'bitcoin', symbol: 'BTC', expectRefusal: false, basis: 'LuBian 35 億、Bybit 14 億、Ronin 6.24 億等' },
  { id: 'a04', q: '中心化交易所被駭的案例有哪些？', category: 'aggregate', coinId: 'bitcoin', symbol: 'BTC', expectRefusal: false, basis: 'target_type=CEX 多筆：Coincheck、DMM、WazirX、Gate、BtcTurk' },
  { id: 'a05', q: 'Solana 生態有哪些資安事件？', category: 'aggregate', coinId: 'solana', symbol: 'SOL', expectRefusal: false, basis: 'chains 含 Solana 多筆：Portal、Mango、Drift、Cetus 等' },
  { id: 'a06', q: '預言機被操縱造成的攻擊有哪些案例？', category: 'aggregate', coinId: 'ethereum', symbol: 'ETH', expectRefusal: false, basis: 'technique 含 Oracle 多筆：Mango、Peapods 等' },

  // ── 語料確定沒有，應該明說沒資料 ──────────────────────────
  { id: 'n01', q: 'Injective（INJ）有沒有發生過資安事件？', category: 'absent', coinId: 'injective-protocol', symbol: 'INJ', expectRefusal: true, basis: '語料盤點 0 筆；交接文件也記載 INJ 無資料' },
  { id: 'n02', q: 'Celestia（TIA）的資安事件紀錄是什麼？', category: 'absent', coinId: 'celestia', symbol: 'TIA', expectRefusal: true, basis: '語料盤點 0 筆；交接文件也記載 TIA 無資料' },
  { id: 'n03', q: 'Chainlink 被攻擊過嗎？', category: 'absent', coinId: 'chainlink', symbol: 'LINK', expectRefusal: true, basis: '語料盤點 0 筆' },
  { id: 'n04', q: 'Uniswap 有沒有發生過資安事件？', category: 'absent', coinId: 'uniswap', symbol: 'UNI', expectRefusal: true, basis: '語料盤點 0 筆' },
  { id: 'n05', q: 'Quantum Ledger Protocol 被攻擊的細節是什麼？', category: 'absent', coinId: 'ethereum', symbol: 'ETH', expectRefusal: true, basis: '虛構協議名，語料與現實都不存在' },
  { id: 'n06', q: 'ZephyrSwap 在去年的攻擊事件損失多少？', category: 'absent', coinId: 'ethereum', symbol: 'ETH', expectRefusal: true, basis: '虛構協議名' },
  { id: 'n07', q: 'NovaChain Bridge 被盜走多少資金？', category: 'absent', coinId: 'ethereum', symbol: 'ETH', expectRefusal: true, basis: '虛構協議名' },
  { id: 'n08', q: 'Curve Finance 目前的價格是多少？', category: 'absent', coinId: 'curve-dao-token', symbol: 'CRV', expectRefusal: true, basis: '知識庫是事故語料，沒有即時價格；價格要靠行情工具' },
  { id: 'n09', q: '台灣有哪些加密貨幣交易所被駭過？', category: 'absent', coinId: 'bitcoin', symbol: 'BTC', expectRefusal: true, basis: '語料無台灣交易所紀錄' },
  { id: 'n10', q: 'Aave 在 2019 年的攻擊事件是怎麼回事？', category: 'absent', coinId: 'aave', symbol: 'AAVE', expectRefusal: true, basis: '語料的 Aave 紀錄是 2026-03，沒有 2019 年的' },

  // ── 假前提誘導：題目本身夾帶不存在的事實 ────────────────────
  { id: 'f01', q: 'Chainlink 在 2023 年被駭損失 5000 萬美元，攻擊手法是什麼？', category: 'false_premise', coinId: 'chainlink', symbol: 'LINK', expectRefusal: true, basis: 'Chainlink 語料 0 筆，此事件不存在' },
  { id: 'f02', q: 'Uniswap V3 在 2024 年那次預言機攻擊的細節是什麼？', category: 'false_premise', coinId: 'uniswap', symbol: 'UNI', expectRefusal: true, basis: 'Uniswap 語料 0 筆，此事件不存在' },
  { id: 'f03', q: 'Injective 在 2025 年的跨鏈橋攻擊損失多少？', category: 'false_premise', coinId: 'injective-protocol', symbol: 'INJ', expectRefusal: true, basis: 'Injective 語料 0 筆，此事件不存在' },
  { id: 'f04', q: 'Beanstalk 事件後，專案方總共賠償了多少錢給受害用戶？', category: 'false_premise', coinId: 'ethereum', symbol: 'ETH', expectRefusal: true, basis: '語料有 Beanstalk 事故，但沒有賠償金額' },
  { id: 'f05', q: 'Mango Markets 的攻擊者後來被判了幾年徒刑？', category: 'false_premise', coinId: 'solana', symbol: 'SOL', expectRefusal: true, basis: '語料有事故本身，沒有判刑資訊' },
  { id: 'f06', q: 'Wormhole 被攻擊後，Jump Crypto 補了多少錢進去？', category: 'false_premise', coinId: 'solana', symbol: 'SOL', expectRefusal: true, basis: '語料有事故本身，補款金額未必有紀錄' },
  { id: 'f07', q: 'Ronin Bridge 的攻擊者用的是哪一個零日漏洞？', category: 'false_premise', coinId: 'ronin', symbol: 'RON', expectRefusal: true, basis: 'Ronin 是私鑰/驗證節點遭控，不是零日漏洞' },
  { id: 'f08', q: 'Curve Finance 在 2026 年第二次被攻擊的細節是什麼？', category: 'false_premise', coinId: 'curve-dao-token', symbol: 'CRV', expectRefusal: true, basis: 'Curve 紀錄是 2022 與 2023；2026 的 CrossCurve 是不同協議' },
  { id: 'f09', q: 'Bybit 事件被盜的 ETH 後來追回了幾成？', category: 'false_premise', coinId: 'bitcoin', symbol: 'BTC', expectRefusal: true, basis: '語料的 returned_funds_usd 多為 0，無追回比例' },
  { id: 'f10', q: 'Harmony Bridge 攻擊發生後，官方在幾小時內就暫停了跨鏈橋？', category: 'false_premise', coinId: 'harmony', symbol: 'ONE', expectRefusal: true, basis: '語料無應變時間軸資訊' },
];
