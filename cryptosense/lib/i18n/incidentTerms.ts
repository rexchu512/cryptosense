/**
 * Chinese labels for DefiLlama's incident vocabulary.
 *
 * The product speaks Traditional Chinese to retail investors, but the incident
 * dataset carries English security jargon — "Flashloan Price Oracle Attack",
 * "Access Control Exploit". Left untranslated on the card, the one section
 * with genuinely differentiated content is the one the reader cannot parse.
 *
 * The dataset holds 262 distinct technique strings with a very long tail, so
 * an exact table alone would leave most of them in English. Two layers:
 *
 *   1. Exact entries for the names that dominate the data — best wording.
 *   2. Term-by-term substitution for everything else. English technique names
 *      are modifier-first, and so are the Chinese compounds, so a positional
 *      swap reads correctly far more often than it has any right to.
 *
 * Tokens with no entry survive untouched on purpose: "Safe" and "Multisig"
 * name a specific product, and dropping them would strip the only identifying
 * detail in the phrase.
 */

const UNKNOWN_TECHNIQUE = "手法不明";
const UNKNOWN_CLASSIFICATION = "分類不明";

/** Keyed lowercase; covers the head of the distribution. */
const TECHNIQUE_ZH: Record<string, string> = {
  "private key compromised": "私鑰遭盜用",
  "admin key compromised": "管理員私鑰遭盜用",
  "hot wallet compromise": "熱錢包遭入侵",
  "cloudflare key compromised": "Cloudflare 金鑰遭盜用",
  "access control exploit": "權限控管漏洞",
  "flashloan price oracle attack": "閃電貸價格預言機攻擊",
  "flashloan reentrancy attack": "閃電貸重入攻擊",
  "flashloan exploit": "閃電貸漏洞利用",
  "flashloan price manipulation": "閃電貸價格操縱",
  "price oracle attack": "價格預言機攻擊",
  "price oracle manipulation": "價格預言機操縱",
  "oracle misconfiguration exploit": "預言機設定錯誤漏洞",
  "outdated oracle exploit": "預言機報價過期漏洞",
  "price manipulation attack": "價格操縱攻擊",
  "liquidity manipulation exploit": "流動性操縱漏洞",
  reentrancy: "重入攻擊",
  "infinite mint and dump": "無限增發後拋售",
  "drained contracts": "合約資金被抽乾",
  "drained liquidity pool": "流動性池被抽乾",
  "drain vaults": "金庫被抽乾",
  "router exploit": "路由合約漏洞",
  "router exploit via infinite approvals": "無限授權導致路由合約被利用",
  "donation attack": "捐贈攻擊",
  "bridge verification bypass": "跨鏈橋驗證繞過",
  "fake bridge address": "偽造跨鏈橋地址",
  "missing input validation": "缺少輸入驗證",
  "math mistake exploit": "數學運算錯誤漏洞",
  "fake proof exploit": "偽造證明漏洞",
  "fake collateral exploit": "偽造抵押品漏洞",
  "signature exploit": "簽章驗證漏洞",
  "arbitrary external call": "任意外部呼叫",
  "malicious governance proposal": "惡意治理提案",
  "social engineering": "社交工程",
  "dns spoofing": "DNS 劫持",
  unknown: UNKNOWN_TECHNIQUE,
};

const CLASSIFICATION_ZH: Record<string, string> = {
  "protocol logic": "協議邏輯漏洞",
  infrastructure: "基礎設施",
  ecosystem: "生態系",
  rugpull: "捲款跑路",
  "smart contract language": "智慧合約語言",
};

/** Longest phrases first, so "Price Oracle" wins over a bare "Oracle". */
const GLOSSARY: [RegExp, string][] = (
  [
    ["price feed", "報價來源"],
    ["price oracle", "價格預言機"],
    ["social engineering", "社交工程"],
    ["access control", "權限控管"],
    ["incentive rewards", "獎勵機制"],
    ["pool shares", "資金池份額"],
    ["private key", "私鑰"],
    ["hot wallet", "熱錢包"],
    ["smart contract", "智慧合約"],
    ["liquidity pool", "流動性池"],
    ["flashloan", "閃電貸"],
    ["flash loan", "閃電貸"],
    ["reentrancy", "重入"],
    ["oracle", "預言機"],
    ["governance", "治理"],
    ["multisig", "多重簽章"],
    ["signature", "簽章"],
    ["phishing", "釣魚"],
    ["compromised", "遭盜用"],
    ["compromise", "遭入侵"],
    ["manipulation", "操縱"],
    ["exploit", "漏洞利用"],
    ["attack", "攻擊"],
    ["bridge", "跨鏈橋"],
    ["wallet", "錢包"],
    ["vault", "金庫"],
    ["collateral", "抵押品"],
    ["liquidity", "流動性"],
    ["withdrawal", "提領"],
    ["deposit", "存入"],
    ["bypass", "繞過"],
    ["mint", "增發"],
    ["drain", "抽乾"],
    ["drained", "被抽乾"],
    ["fake", "偽造"],
    ["malicious", "惡意"],
    ["misconfiguration", "設定錯誤"],
    ["validation", "驗證"],
    ["logic", "邏輯"],
    ["rugpull", "捲款跑路"],
    ["theft", "竊取"],
    ["scam", "詐騙"],
    ["incentives", "獎勵"],
    ["incentive", "獎勵"],
    ["rewards", "獎勵"],
    ["function", "函式"],
    ["shares", "份額"],
    ["donate", "捐贈"],
    ["donation", "捐贈"],
    ["mistake", "錯誤"],
    ["flaw", "缺陷"],
    ["market", "市場"],
    ["pool", "資金池"],
    ["router", "路由合約"],
    ["proof", "證明"],
    ["input", "輸入"],
    ["key", "金鑰"],
    ["contracts", "合約"],
    ["contract", "合約"],
    ["upgrade", "升級"],
    ["proxy", "代理合約"],
    ["admin", "管理員"],
    ["frontend", "前端"],
    ["server", "伺服器"],
    ["settlement", "結算"],
    ["rounding", "四捨五入"],
    ["overflow", "溢位"],
    ["slippage", "滑價"],
    ["arbitrary", "任意"],
    ["external", "外部"],
    ["call", "呼叫"],
    ["missing", "缺少"],
    ["invalid", "無效"],
    ["unverified", "未驗證"],
    ["insufficient", "不足"],
    ["compromised", "遭盜用"],
    ["hack", "攻擊事件"],
    ["borrow", "借貸"],
    ["borrowing", "借貸"],
    ["lending", "借貸"],
    ["redeem", "贖回"],
    ["redemption", "贖回"],
    ["error", "錯誤"],
    ["ownership", "所有權"],
    ["override", "覆寫"],
    ["storage", "儲存"],
    ["slot", "插槽"],
    ["staking", "質押"],
    ["swap", "兌換"],
    ["burn", "銷毀"],
    ["transfer", "轉帳"],
    ["approval", "授權"],
    ["approvals", "授權"],
    ["initialization", "初始化"],
    ["uninitialized", "未初始化"],
    ["verification", "驗證"],
    ["whitelist", "白名單"],
    ["blacklist", "黑名單"],
    ["timelock", "時間鎖"],
    ["vulnerability", "漏洞"],
    ["misuse", "誤用"],
    ["leak", "外洩"],
    ["leaked", "外洩"],
    ["stolen", "遭竊"],
    ["insider", "內部人員"],
    ["exit", "退出"],
    ["fraud", "詐欺"],
  ] as [string, string][]
).map(([en, zh]) => [new RegExp(`\\b${en}\\b`, "gi"), zh]);

const isCjk = (ch: string) => /[㐀-鿿豈-﫿]/.test(ch);

/** Drop the spaces English left behind between two Chinese runs. */
function tidy(s: string): string {
  return s
    .replace(/\s+/g, " ")
    .trim()
    .replace(/(.) (.)/g, (m, a, b) => (isCjk(a) && isCjk(b) ? a + b : m))
    .replace(/(.) (.)/g, (m, a, b) => (isCjk(a) && isCjk(b) ? a + b : m));
}

export function translateTechnique(en?: string | null): string {
  const raw = (en ?? "").trim();
  if (!raw) return UNKNOWN_TECHNIQUE;

  const exact = TECHNIQUE_ZH[raw.toLowerCase()];
  if (exact) return exact;

  let out = raw;
  for (const [re, zh] of GLOSSARY) out = out.replace(re, zh);
  const tidied = tidy(out);
  return tidied || UNKNOWN_TECHNIQUE;
}

export function translateClassification(en?: string | null): string {
  const raw = (en ?? "").trim();
  if (!raw) return UNKNOWN_CLASSIFICATION;
  return CLASSIFICATION_ZH[raw.toLowerCase()] ?? raw;
}
