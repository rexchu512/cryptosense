// 精確盤點三個異常：無 source 的檔、真正重複的檔、磁碟有但 store 沒有的檔
import path from 'node:path';
import { CORPORA, listCorpusFiles, loadEnv, loadProgress } from './corpus-lib.mjs';

const p = loadProgress();
const env = loadEnv();
const H = { Authorization: `Bearer ${env.OPENAI_API_KEY}` };
const VS = p.storeId;

let after = null;
const files = [];
for (;;) {
  const url = new URL(`https://api.openai.com/v1/vector_stores/${VS}/files`);
  url.searchParams.set('limit', '100');
  if (after) url.searchParams.set('after', after);
  const page = await fetch(url, { headers: H }).then((r) => r.json());
  files.push(...page.data);
  if (!page.has_more) break;
  after = page.last_id;
}
console.log('store 內檔案總數:', files.length, '\n');

// 1) 沒有 source 屬性的
console.log('=== 1) 缺 source 屬性 ===');
for (const f of files) {
  if (!f.attributes?.source) {
    console.log(' ', f.id, 'status=' + f.status, JSON.stringify(f.attributes).slice(0, 250));
  }
}

// 2) 真正的重複：同一份磁碟檔案被掛載超過一次。
//    用 progress.json 反查 file_id -> 磁碟路徑；store 裡多出來的 file_id 就是孤兒。
console.log('\n=== 2) 重複與孤兒 ===');
const idToPath = new Map(Object.entries(p.done).map(([k, v]) => [v, k]));
const storeIds = new Set(files.map((f) => f.id));
const orphans = files.filter((f) => !idToPath.has(f.id));
console.log('進度檔沒記錄、但在 store 裡的檔案（孤兒）:', orphans.length);
for (const o of orphans.slice(0, 20)) {
  console.log('  ', o.id, JSON.stringify({ source: o.attributes?.source, title: o.attributes?.title, url: o.attributes?.url }).slice(0, 200));
}
const missingFromStore = [...idToPath.entries()].filter(([id]) => !storeIds.has(id));
console.log('\n進度檔有記錄、但 store 找不到:', missingFromStore.length);
for (const [id, fp] of missingFromStore.slice(0, 20)) console.log('  ', id, fp);

// 3) 磁碟上有、但進度檔沒記錄的
console.log('\n=== 3) 磁碟 vs 進度檔 ===');
let missing = 0;
for (const c of CORPORA) {
  for (const f of listCorpusFiles(c.dir, c.exts)) {
    if (!p.done[f]) { if (missing < 15) console.log('  未上傳:', f); missing++; }
  }
}
console.log('磁碟上未上傳的檔案數:', missing);

// 4) defillama 同名協議是不是真的同一件事（用 date_num 分辨）
console.log('\n=== 4) defillama「同標題」是否為不同事件 ===');
const yearn = files.filter((f) => f.attributes?.source === 'defillama-hacks' && String(f.attributes?.title ?? '').includes('Yearn'));
yearn.forEach((f) => console.log('  ', f.attributes.title, '| date=', f.attributes.date, '| loss=', f.attributes.loss_usd));
