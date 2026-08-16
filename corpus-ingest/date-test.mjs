import assert from 'node:assert/strict';
import { normalizeDate } from './corpus-lib.mjs';

const cases = [
  ['06/22/2021', 20210622, 'rekt 補零'],
  ['6/22/2021', 20210622, 'rekt 月份未補零'],
  ['6/2/2021', 20210602, 'rekt 月日皆未補零'],
  ['06/2/2021', 20210602, 'rekt 只有日未補零'],
  ['12/31/21', 20211231, 'rekt 兩位數年份'],
  ['2025-12-11', 20251211, 'defillama ISO'],
  ['2025-1-5', 20250105, 'defillama 未補零'],
  [20260225, 20260225, 'youtube 數值'],
  ['20260225', 20260225, 'youtube 字串'],
  ['', null, '空字串'],
  [undefined, null, 'undefined'],
  ['not a date', null, '垃圾字串'],
  ['13/45/2021', null, '不合法的月日'],
  ['06/22/1899', null, '年份超出範圍'],
];

let pass = 0;
for (const [input, expected, label] of cases) {
  try {
    assert.equal(normalizeDate(input), expected);
    pass++;
  } catch {
    console.log(`FAIL  ${label}: normalizeDate(${JSON.stringify(input)}) = ${normalizeDate(input)}, 應為 ${expected}`);
  }
}
console.log(`${pass}/${cases.length} 通過`);
if (pass !== cases.length) process.exit(1);
