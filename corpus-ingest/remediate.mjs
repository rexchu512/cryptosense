// 修補：1) 補上 2 個檔案殘缺的屬性  2) 刪掉 4 個重複的 YouTube 逐字稿
import path from 'node:path';
import { parseCorpusFile, loadEnv, loadProgress } from './corpus-lib.mjs';

const p = loadProgress();
const env = loadEnv();
const H = { Authorization: `Bearer ${env.OPENAI_API_KEY}` };
const VS = p.storeId;
const DRY = process.argv.includes('--dry');
console.log(DRY ? '=== 試跑模式，不會動到任何東西 ===\n' : '=== 實際執行 ===\n');

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

const idToPath = new Map(Object.entries(p.done).map(([k, v]) => [v, k]));

// --- 1) 補屬性：store 裡缺 source 的檔案，用磁碟上重新解析的結果覆蓋
console.log('--- 補屬性 ---');
const broken = files.filter((f) => !f.attributes?.source);
for (const f of broken) {
  const disk = idToPath.get(f.id);
  if (!disk) { console.log('  找不到對應的磁碟檔案，跳過:', f.id); continue; }
  const { attrs } = parseCorpusFile(disk);
  console.log(`  ${path.basename(disk)}`);
  console.log(`    原本: ${JSON.stringify(f.attributes)}`);
  console.log(`    改為: ${Object.keys(attrs).length} 個屬性, source=${attrs.source}, date_num=${attrs.date_num}`);
  if (!attrs.source) { console.log('    重新解析仍無 source，跳過'); continue; }
  if (DRY) continue;
  const res = await fetch(`https://api.openai.com/v1/vector_stores/${VS}/files/${f.id}`, {
    method: 'POST', headers: { ...H, 'Content-Type': 'application/json' },
    body: JSON.stringify({ attributes: attrs }),
  });
  console.log('    更新結果:', res.ok ? 'OK' : `HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
}
if (!broken.length) console.log('  沒有缺屬性的檔案。');

// --- 2) 刪重複：進度檔沒記錄、但 store 裡有的孤兒（同一支影片的第二份副本）
console.log('\n--- 刪除重複 ---');
const orphans = files.filter((f) => !idToPath.has(f.id));
for (const o of orphans) {
  // 安全檢查：只有在「同一個 url 另有一份被進度檔記錄」時才刪
  const twin = files.find(
    (f) => f.id !== o.id && idToPath.has(f.id) && f.attributes?.url && f.attributes.url === o.attributes?.url
  );
  if (!twin) { console.log('  找不到已記錄的同源副本，保留不刪:', o.id, o.attributes?.title); continue; }
  console.log(`  刪除 ${o.id}  (保留 ${twin.id})  ${String(o.attributes?.title).slice(0, 40)}`);
  if (DRY) continue;
  const d1 = await fetch(`https://api.openai.com/v1/vector_stores/${VS}/files/${o.id}`, { method: 'DELETE', headers: H });
  const d2 = await fetch(`https://api.openai.com/v1/files/${o.id}`, { method: 'DELETE', headers: H });
  console.log(`    store 移除=${d1.ok ? 'OK' : d1.status}  檔案刪除=${d2.ok ? 'OK' : d2.status}`);
}
if (!orphans.length) console.log('  沒有重複檔案。');
