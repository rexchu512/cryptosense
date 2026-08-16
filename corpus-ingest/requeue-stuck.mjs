// 把卡在 in_progress 或 failed 的檔案刪掉重傳。
// 曾遇過一個 900 bytes 的小檔卡在 in_progress 超過一分鐘、last_error 是 null，
// 不會自己好，也不會變成 failed —— 只能重傳。
// 用法：node requeue-stuck.mjs [--dry]
import fs from 'node:fs';
import path from 'node:path';
import { parseCorpusFile, loadEnv, loadProgress, saveProgress } from './corpus-lib.mjs';

const DRY = process.argv.includes('--dry');
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

const idToPath = new Map(Object.entries(p.done).map(([k, v]) => [v, k]));
const stuck = files.filter((f) => f.status !== 'completed');
console.log(`卡住/失敗的檔案：${stuck.length} 個${DRY ? '（試跑，不會動）' : ''}\n`);

for (const f of stuck) {
  const disk = idToPath.get(f.id);
  if (!disk) { console.log('  找不到磁碟來源，跳過:', f.id); continue; }
  console.log(`  ${path.basename(disk)}  status=${f.status}`);
  if (DRY) continue;

  // 先移除舊的，再重傳一份新的
  await fetch(`https://api.openai.com/v1/vector_stores/${VS}/files/${f.id}`, { method: 'DELETE', headers: H });
  await fetch(`https://api.openai.com/v1/files/${f.id}`, { method: 'DELETE', headers: H });

  const { attrs } = parseCorpusFile(disk);
  const fd = new FormData();
  fd.append('purpose', 'assistants');
  fd.append('file', new Blob([fs.readFileSync(disk)], { type: 'text/plain' }), path.basename(disk));
  const up = await fetch('https://api.openai.com/v1/files', { method: 'POST', headers: H, body: fd }).then((r) => r.json());

  const res = await fetch(`https://api.openai.com/v1/vector_stores/${VS}/files`, {
    method: 'POST', headers: { ...H, 'Content-Type': 'application/json' },
    body: JSON.stringify({ file_id: up.id, attributes: attrs }),
  });
  if (!res.ok) { console.log('    重傳失敗:', res.status, (await res.text()).slice(0, 200)); continue; }
  p.done[disk] = up.id;
  saveProgress(p);
  console.log('    重傳完成:', up.id);

  // 等它真的索引好，不要重複製造「以為好了」的狀態
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    const s = await fetch(`https://api.openai.com/v1/vector_stores/${VS}/files/${up.id}`, { headers: H }).then((r) => r.json());
    if (s.status === 'completed') { console.log('    索引完成'); break; }
    if (s.status === 'failed') { console.log('    索引失敗:', JSON.stringify(s.last_error)); break; }
    if (i === 19) console.log('    等了 60 秒仍是', s.status, '—— 需要人工確認');
  }
}
if (!stuck.length) console.log('  沒有卡住的檔案。');
