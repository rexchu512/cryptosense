// 新舊 store 的檢索對照：同樣的問題，看各自撈回什麼
import { loadEnv, loadProgress } from './corpus-lib.mjs';

const p = loadProgress();
const env = loadEnv();
const H = { Authorization: `Bearer ${env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' };
const NEW = p.storeId;
const OLD = env.OPENAI_VECTOR_STORE_ID;

// 先確認還在索引中的檔案收尾了沒
for (let i = 0; i < 15; i++) {
  const s = await fetch(`https://api.openai.com/v1/vector_stores/${NEW}`, { headers: H }).then((r) => r.json());
  if (s.file_counts.in_progress <= 0) { console.log('新 store 索引狀態:', JSON.stringify(s.file_counts), '\n'); break; }
  await new Promise((r) => setTimeout(r, 3000));
}

const QUERIES = [
  'Curve Finance 被駭過嗎？損失多少？',
  'Solana 生態有哪些資安事件？',
  '跨鏈橋被攻擊的案例',
  'Terra Luna 崩盤是怎麼回事',
];

async function search(vs, query) {
  const r = await fetch(`https://api.openai.com/v1/vector_stores/${vs}/search`, {
    method: 'POST', headers: H,
    body: JSON.stringify({ query, max_num_results: 5, rewrite_query: true, ranking_options: { ranker: 'auto', score_threshold: 0.35 } }),
  }).then((x) => x.json());
  if (r.error) return [`ERROR: ${r.error.message}`];
  return (r.data ?? []).map((d) => `${d.score.toFixed(3)} ${String(d.filename).slice(0, 58)}`);
}

for (const q of QUERIES) {
  console.log('=== ' + q);
  const [oldRes, newRes] = await Promise.all([search(OLD, q), search(NEW, q)]);
  console.log('  [舊 Discord store]');
  oldRes.length ? oldRes.forEach((l) => console.log('    ' + l)) : console.log('    (score>=0.35 沒有結果)');
  console.log('  [新語料 store]');
  newRes.length ? newRes.forEach((l) => console.log('    ' + l)) : console.log('    (score>=0.35 沒有結果)');
  console.log('');
}
