// 驗收：新 store 的索引狀態、重複檔案、屬性完整度、來源分佈
import { CORPORA, listCorpusFiles, loadEnv, loadProgress } from './corpus-lib.mjs';

const p = loadProgress();
const env = loadEnv();
const H = { Authorization: `Bearer ${env.OPENAI_API_KEY}` };
const VS = p.storeId;

const store = await fetch(`https://api.openai.com/v1/vector_stores/${VS}`, { headers: H }).then((r) => r.json());
console.log('store    :', VS);
console.log('名稱     :', store.name);
console.log('用量     :', (store.usage_bytes / 1024 / 1024).toFixed(1), 'MB');
console.log('檔案計數 :', JSON.stringify(store.file_counts));
console.log('');

// 逐頁抓全部
let after = null;
const files = [];
for (;;) {
  const url = new URL(`https://api.openai.com/v1/vector_stores/${VS}/files`);
  url.searchParams.set('limit', '100');
  if (after) url.searchParams.set('after', after);
  const page = await fetch(url, { headers: H }).then((r) => r.json());
  if (page.error) { console.error('LIST ERROR:', page.error.message); break; }
  files.push(...page.data);
  if (!page.has_more) break;
  after = page.last_id;
}
console.log('實際掛載檔案數:', files.length);

const byStatus = {};
for (const f of files) byStatus[f.status] = (byStatus[f.status] || 0) + 1;
console.log('索引狀態:', JSON.stringify(byStatus));

const failed = files.filter((f) => f.status === 'failed');
if (failed.length) {
  console.log('\n索引失敗的檔案:');
  failed.slice(0, 10).forEach((f) => console.log('  ', f.id, JSON.stringify(f.last_error)));
}

// 重複偵測。
// 注意：不能只用 source+title —— 同一個協議被駭多次是常態（Yearn Finance 有 3 次），
// 那是不同事件不是重複資料。必須把日期算進去才分得出來。
const seen = new Map();
let noAttr = 0;
let noSource = 0;
for (const f of files) {
  const a = f.attributes ?? {};
  if (Object.keys(a).length === 0) { noAttr++; continue; }
  if (!a.source) noSource++;
  // 連日期都不夠：Mirror 在 2021-10-08 一天內有兩起不同事件（200 萬 / 9000 萬，
  // 手法也不同）。要靠手法與損失金額才分得出「不同事件」和「重複資料」。
  const key = [a.source, a.title, a.url ?? '', a.date_num ?? '', a.technique ?? '', a.loss_usd ?? ''].join('||');
  seen.set(key, (seen.get(key) ?? 0) + 1);
}
const dupes = [...seen.entries()].filter(([, n]) => n > 1);
console.log('\n無屬性的檔案:', noAttr);
console.log('缺 source 的檔案:', noSource);
console.log('重複的語料條目:', dupes.length);
dupes.slice(0, 10).forEach(([k, n]) => console.log(`  x${n}  ${k.slice(0, 110)}`));

// 對照進度檔：store 裡不該有進度檔沒記錄的檔案
const idToPath = new Map(Object.entries(p.done).map(([k, v]) => [v, k]));
const orphans = files.filter((f) => !idToPath.has(f.id));
console.log('進度檔未記錄的孤兒檔案:', orphans.length);

// 來源分佈 vs 磁碟上的實際檔數
const bySource = {};
for (const f of files) {
  const s = f.attributes?.source ?? '(無)';
  bySource[s] = (bySource[s] || 0) + 1;
}
console.log('\n來源分佈（store）:');
Object.entries(bySource).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`  ${k.padEnd(18)} ${v}`));

console.log('\n磁碟上的應有檔數:');
let expect = 0;
for (const c of CORPORA) {
  const n = listCorpusFiles(c.dir, c.exts).length;
  expect += n;
  console.log(`  ${c.label.padEnd(18)} ${n}`);
}
console.log(`  ${'合計'.padEnd(16)} ${expect}`);

console.log('');
const clean = files.length === expect && !failed.length && dupes.length === 0
  && noAttr === 0 && noSource === 0 && orphans.length === 0;
console.log(clean ? '驗收通過：數量相符、無失敗、無重複、無孤兒、屬性齊全。'
                  : `需要處理：掛載=${files.length} 應有=${expect} 失敗=${failed.length} 重複=${dupes.length} 無屬性=${noAttr} 缺source=${noSource} 孤兒=${orphans.length}`);
