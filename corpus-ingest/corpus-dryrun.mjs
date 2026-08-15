// 唯讀試跑：不上傳，只檢查標頭解析結果是否合規
import { CORPORA, listCorpusFiles, parseCorpusFile, MAX_KEYS } from './corpus-lib.mjs';

let grandTotal = 0;
const problems = [];

for (const c of CORPORA) {
  const files = listCorpusFiles(c.dir, c.exts);
  const keyUnion = new Set();
  let noAttrs = 0;
  let maxKeys = 0;
  let totalChars = 0;
  let emptyBody = 0;

  for (const f of files) {
    const { attrs, bodyStartLine, raw, charCount } = parseCorpusFile(f);
    const n = Object.keys(attrs).length;
    maxKeys = Math.max(maxKeys, n);
    totalChars += charCount;
    Object.keys(attrs).forEach((k) => keyUnion.add(k));
    if (n === 0) { noAttrs++; problems.push(`[${c.label}] 無任何屬性: ${f}`); }
    // 缺 source 就無法做來源過濾，也代表標頭解析出了問題 —— 這是上一版漏掉的檢查
    if (!attrs.source) problems.push(`[${c.label}] 缺 source 屬性: ${f}`);
    if (!attrs.title) problems.push(`[${c.label}] 缺 title 屬性: ${f}`);
    if (n > MAX_KEYS) problems.push(`[${c.label}] 屬性超過 ${MAX_KEYS} 個 (${n}): ${f}`);
    const body = raw.split(/\r?\n/).slice(bodyStartLine).join('\n').trim();
    if (body.length < 50) { emptyBody++; if (emptyBody <= 3) problems.push(`[${c.label}] 正文幾乎是空的 (${body.length} 字): ${f}`); }
    for (const [k, v] of Object.entries(attrs)) {
      if (k.length > 256) problems.push(`[${c.label}] key 過長: ${k}`);
      const t = typeof v;
      if (t !== 'string' && t !== 'number' && t !== 'boolean') problems.push(`[${c.label}] 值型別不合法 ${k}=${t}`);
    }
  }

  grandTotal += files.length;
  // 粗估 token：中文約 1 字 1 token，英文約 4 字元 1 token，取保守的 2 字元/token
  const estTokens = Math.round(totalChars / 2);
  console.log(
    `${c.label.padEnd(10)} 檔數=${String(files.length).padStart(4)}  ` +
    `最多屬性=${maxKeys}  無屬性=${noAttrs}  正文過短=${emptyBody}  ` +
    `估計總 tokens≈${(estTokens / 1000).toFixed(0)}k`
  );
  console.log(`${' '.repeat(10)} 屬性欄位: ${[...keyUnion].sort().join(', ')}`);
}

console.log(`\n合計要上傳: ${grandTotal} 個檔案`);
console.log(`\n問題清單 (${problems.length}):`);
if (problems.length === 0) console.log('  無');
else problems.slice(0, 25).forEach((p) => console.log('  ' + p));
if (problems.length > 25) console.log(`  ...另外還有 ${problems.length - 25} 筆`);
