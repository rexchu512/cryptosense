// 唯讀：列出某個 vector store 的檔案索引狀態
// 用法：node vs-status.mjs [store_id]  預設讀 .env.local 裡的 OPENAI_VECTOR_STORE_ID
import { loadEnv } from './corpus-lib.mjs';

const env = loadEnv();
const KEY = env.OPENAI_API_KEY;
const VS = process.argv[2] ?? env.OPENAI_VECTOR_STORE_ID;
const H = { Authorization: `Bearer ${KEY}`, 'OpenAI-Beta': 'assistants=v2' };

const store = await fetch(`https://api.openai.com/v1/vector_stores/${VS}`, { headers: H }).then((r) => r.json());
if (store.error) {
  console.error('STORE ERROR:', store.error.message);
  process.exit(1);
}
console.log('store name  :', store.name);
console.log('store bytes :', (store.usage_bytes / 1024 / 1024).toFixed(1), 'MB');
console.log('file_counts :', JSON.stringify(store.file_counts));
console.log('');

// 逐頁抓完所有檔案
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

const byStatus = {};
for (const f of files) byStatus[f.status] = (byStatus[f.status] || 0) + 1;
console.log('總檔數:', files.length);
console.log('狀態分佈:', JSON.stringify(byStatus));
console.log('');

const failed = files.filter((f) => f.status !== 'completed');
if (failed.length) {
  console.log('--- 非 completed 的檔案 ---');
  for (const f of failed) {
    const meta = await fetch(`https://api.openai.com/v1/files/${f.id}`, { headers: H }).then((r) => r.json());
    console.log(
      [
        f.status,
        (f.usage_bytes / 1024 / 1024).toFixed(2) + 'MB',
        meta.filename ?? f.id,
        f.last_error ? `err=${f.last_error.code}: ${f.last_error.message}` : '',
      ].join('  |  ')
    );
  }
} else {
  console.log('沒有失敗的檔案。');
}

console.log('');
console.log('--- 最大的 5 個檔案 ---');
const top = [...files].sort((a, b) => b.usage_bytes - a.usage_bytes).slice(0, 5);
for (const f of top) {
  const meta = await fetch(`https://api.openai.com/v1/files/${f.id}`, { headers: H }).then((r) => r.json());
  console.log(
    [(f.usage_bytes / 1024 / 1024).toFixed(2) + 'MB', f.status, meta.filename ?? f.id].join('  |  ')
  );
}
