// 把三批新語料上傳到一個「新的」vector store。現有的 Discord store 完全不動。
// 可續傳：已完成的檔案記在 progress.json，重跑會跳過。
import fs from 'node:fs';
import path from 'node:path';
import { CORPORA, listCorpusFiles, parseCorpusFile, loadEnv, loadProgress, saveProgress } from './corpus-lib.mjs';

const STORE_NAME = 'CryptoSense-Incidents-RAG';
const CONCURRENCY = 8;

const env = loadEnv();
const H = { Authorization: `Bearer ${env.OPENAI_API_KEY}` };

/**
 * 429 與 5xx 退避重試。
 *
 * 上一版把 fetch 放在 try 外面，網路層錯誤（fetch 自己丟的 "fetch failed"）
 * 會直接穿過迴圈往上拋 —— 等於零重試。實測結果：跑到第 1231 個檔案時遇到
 * 一次網路中斷，剩下的 414 個檔案在幾秒內全部瞬間失敗。
 * 現在網路層錯誤也走同一條退避重試路徑。
 */
async function api(url, opts, tries = 6) {
  let last;
  for (let t = 0; t < tries; t++) {
    const backoff = () => new Promise((r) => setTimeout(r, Math.min(2 ** t * 1000, 30000) + Math.random() * 500));
    try {
      const res = await fetch(url, opts);
      if (res.ok) return res.json();
      if (res.status === 429 || res.status >= 500) {
        // 讀掉 body 才會把連線還回連線池
        last = new Error(`HTTP ${res.status}: ${(await res.text().catch(() => '')).slice(0, 200)}`);
        await backoff();
        continue;
      }
      // 4xx（除了 429）是我們自己送錯，重試沒有意義
      throw Object.assign(new Error(`${res.status} ${url}\n${await res.text()}`), { fatal: true });
    } catch (e) {
      if (e?.fatal) throw e;
      last = e;
      await backoff();
    }
  }
  throw new Error(`重試 ${tries} 次仍失敗: ${url} — ${last?.message ?? '未知'}`);
}

const p = loadProgress();

if (!p.storeId) {
  const store = await api('https://api.openai.com/v1/vector_stores', {
    method: 'POST',
    headers: { ...H, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: STORE_NAME }),
  });
  p.storeId = store.id;
  saveProgress(p);
  console.log('已建立新 vector store:', store.id);
} else {
  console.log('沿用進度檔裡的 store:', p.storeId);
}

// 收集所有待傳檔案
const queue = [];
for (const c of CORPORA) {
  for (const f of listCorpusFiles(c.dir, c.exts)) {
    if (!p.done[f]) queue.push({ file: f, label: c.label });
  }
}
const alreadyDone = Object.keys(p.done).length;
console.log(`待上傳 ${queue.length} 個檔案（已完成 ${alreadyDone}）\n`);

let ok = 0, failed = 0, n = 0;
const errors = [];

async function uploadOne(item) {
  const { attrs } = parseCorpusFile(item.file);
  const buf = fs.readFileSync(item.file);

  const fd = new FormData();
  fd.append('purpose', 'assistants');
  fd.append('file', new Blob([buf], { type: 'text/plain' }), path.basename(item.file));

  const uploaded = await api('https://api.openai.com/v1/files', { method: 'POST', headers: H, body: fd });

  await api(`https://api.openai.com/v1/vector_stores/${p.storeId}/files`, {
    method: 'POST',
    headers: { ...H, 'Content-Type': 'application/json' },
    body: JSON.stringify({ file_id: uploaded.id, attributes: attrs }),
  });

  return uploaded.id;
}

async function worker() {
  for (;;) {
    const item = queue.shift();
    if (!item) return;
    try {
      const id = await uploadOne(item);
      p.done[item.file] = id;
      ok++;
    } catch (e) {
      failed++;
      errors.push(`${item.file}: ${e.message.slice(0, 200)}`);
    }
    if (++n % 25 === 0) {
      saveProgress(p);
      console.log(`  進度 ${n}  成功=${ok} 失敗=${failed}`);
    }
  }
}

await Promise.all(Array.from({ length: CONCURRENCY }, worker));
saveProgress(p);

console.log(`\n上傳結束：成功 ${ok}、失敗 ${failed}`);
if (errors.length) {
  console.log('\n錯誤（前 10 筆）：');
  errors.slice(0, 10).forEach((e) => console.log('  ' + e));
  console.log('\n重跑本腳本會只重試失敗的檔案。');
}
console.log('\nstore id:', p.storeId);
