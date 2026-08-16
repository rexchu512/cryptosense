/**
 * 讀 eval/results 的結果檔重新出統計。
 * 跟評測本身分開，是為了調整指標時不用重跑一次評測（要花錢也花時間）。
 *
 *   npx tsx eval/report.mts                    # 讀最新一份
 *   npx tsx eval/report.mts fidelity-xxx.json  # 指定檔案
 *   npx tsx eval/report.mts --detail           # 逐題列出編造內容
 */
import fs from 'node:fs';
import path from 'node:path';

const DIR = path.join(import.meta.dirname, 'results');
const args = process.argv.slice(2);
const detail = args.includes('--detail');
const named = args.find((a) => a.endsWith('.json'));

const file = named
  ? path.join(DIR, path.basename(named))
  : path.join(DIR, fs.readdirSync(DIR).filter((f) => f.startsWith('fidelity-')).sort().pop()!);

type R = {
  store: string; id: string; category: string; question: string;
  expectRefusal: boolean; basis: string;
  chunks: { source: string; score: number }[];
  retrievalError?: string;
  answer: string;
  judge: {
    sentences: { text: string; supported: boolean; why: string }[];
    declared_no_data: boolean;
    unsupported_facts: string[];
    misattributed: string[];
    general_commentary: string[];
  };
};

const rows: R[] = JSON.parse(fs.readFileSync(file, 'utf8'));
console.log(`結果檔：${path.basename(file)}   共 ${rows.length} 筆\n`);

const pct = (a: number, b: number) => (b === 0 ? '  — ' : `${((a / b) * 100).toFixed(0)}%`.padStart(4));
const bad = (r: R) => (r.judge.unsupported_facts?.length ?? 0) + (r.judge.misattributed?.length ?? 0);
const CATS = ['grounded', 'aggregate', 'absent', 'false_premise'] as const;
const stores = [...new Set(rows.map((r) => r.store))];

for (const s of stores) {
  const rs = rows.filter((r) => r.store === s);
  const sents = rs.flatMap((r) => r.judge.sentences ?? []);
  const sup = sents.filter((x) => x.supported).length;
  const refQ = rs.filter((r) => r.expectRefusal);
  const refOk = refQ.filter((r) => r.judge.declared_no_data).length;
  const withBad = rs.filter((r) => bad(r) > 0);
  const broken = rs.filter((r) => r.retrievalError);
  const empty = rs.filter((r) => !r.retrievalError && r.chunks.length === 0);
  const commentary = rs.reduce((a, r) => a + (r.judge.general_commentary?.length ?? 0), 0);
  const avgChunks = rs.reduce((a, r) => a + r.chunks.length, 0) / rs.length;
  const avgScore = (() => {
    const all = rs.flatMap((r) => r.chunks.map((c) => c.score));
    return all.length ? all.reduce((a, b) => a + b, 0) / all.length : 0;
  })();
  // 檢索集中度：前 5 名有幾成落在同一個檔案。舊語料的核心毛病就是這個。
  const concentration = (() => {
    const per = rs.map((r) => {
      const top = r.chunks.slice(0, 5).map((c) => c.source);
      if (!top.length) return null;
      const counts = new Map<string, number>();
      top.forEach((t) => counts.set(t, (counts.get(t) ?? 0) + 1));
      return Math.max(...counts.values()) / top.length;
    }).filter((x): x is number => x !== null);
    return per.length ? per.reduce((a, b) => a + b, 0) / per.length : 0;
  })();

  console.log(`━━━ ${s} （${rs.length} 題）`);
  console.log(`  句子支撐率          ${pct(sup, sents.length)}   (${sup}/${sents.length} 句)`);
  console.log(`  誠實拒答率          ${pct(refOk, refQ.length)}   (${refOk}/${refQ.length} 題)`);
  console.log(`  有編造事實的題數    ${String(withBad.length).padStart(4)}   /${rs.length}`);
  console.log(`  無根據的一般性分析  ${String(commentary).padStart(4)} 句`);
  console.log(`  查無資料            ${String(empty.length).padStart(4)}   /${rs.length}`);
  if (broken.length) console.log(`  檢索故障            ${String(broken.length).padStart(4)}   /${rs.length}  ← 這些題的數字不可信`);
  console.log(`  平均回傳片段        ${avgChunks.toFixed(1)}   平均相似度 ${avgScore.toFixed(3)}`);
  console.log(`  前 5 名集中在同檔   ${(concentration * 100).toFixed(0)}%  （越高代表檢索越被單一檔案壟斷）`);
  console.log('');
  for (const c of CATS) {
    const cr = rs.filter((r) => r.category === c);
    if (!cr.length) continue;
    const cs = cr.flatMap((r) => r.judge.sentences ?? []);
    const crf = cr.filter((r) => r.expectRefusal);
    console.log(
      `    ${c.padEnd(14)} 支撐 ${pct(cs.filter((x) => x.supported).length, cs.length)}` +
      `   編造 ${String(cr.filter((r) => bad(r) > 0).length)}/${cr.length}` +
      (crf.length ? `   拒答 ${crf.filter((r) => r.judge.declared_no_data).length}/${crf.length}` : '')
    );
  }
  console.log('');
}

// ── 逐題對照 ────────────────────────────────────────────
if (stores.length === 2) {
  console.log('━━━ 逐題對照（支撐率 / 是否編造）\n');
  console.log(`  ${'題號'.padEnd(6)}${'類別'.padEnd(15)}${stores[0].slice(0, 10).padEnd(14)}${stores[1].slice(0, 10)}`);
  const ids = [...new Set(rows.map((r) => r.id))].sort();
  for (const id of ids) {
    const cells = stores.map((s) => {
      const r = rows.find((x) => x.store === s && x.id === id);
      if (!r) return '—'.padEnd(14);
      const ss = r.judge.sentences ?? [];
      const rate = ss.length ? `${Math.round((ss.filter((x) => x.supported).length / ss.length) * 100)}%` : '—';
      return `${rate.padStart(4)} ${bad(r) > 0 ? '編造' : '  ok'}`.padEnd(14);
    });
    const cat = rows.find((x) => x.id === id)!.category;
    console.log(`  ${id.padEnd(6)}${cat.padEnd(15)}${cells.join('')}`);
  }
  console.log('');
}

if (detail) {
  console.log('━━━ 編造內容明細\n');
  for (const r of rows.filter((x) => bad(x) > 0)) {
    console.log(`  [${r.store}] ${r.id} (${r.category}) ${r.question}`);
    r.judge.unsupported_facts?.forEach((f) => console.log(`     無根據事實：${f.slice(0, 150)}`));
    r.judge.misattributed?.forEach((f) => console.log(`     張冠李戴：${f.slice(0, 150)}`));
    console.log('');
  }
}
