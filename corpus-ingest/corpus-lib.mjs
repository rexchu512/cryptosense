// 共用：解析語料的中繼資料標頭，轉成 vector store attributes
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** OpenAI 限制：每檔最多 16 個 key，key <= 256 字元，值只能是字串/數字/布林 */
export const MAX_KEYS = 16;

/** 本目錄。用 fileURLToPath 而不是手動剝 URL 的斜線，Windows 磁碟機代號才不會出錯。 */
export const HERE = path.dirname(fileURLToPath(import.meta.url));
export const PROGRESS_PATH = path.join(HERE, 'upload-progress.json');
/** 語料與 .env.local 都在專案根目錄，也就是本目錄的上一層 */
export const ROOT = path.resolve(HERE, '..');

export function loadEnv() {
  const p = path.join(ROOT, 'cryptosense', '.env.local');
  return Object.fromEntries(
    fs.readFileSync(p, 'utf8')
      .split(/\r?\n/)
      .filter((l) => /^\s*[A-Z_0-9]+\s*=/.test(l))
      .map((l) => {
        const i = l.indexOf('=');
        return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')];
      })
  );
}

export function loadProgress() {
  if (fs.existsSync(PROGRESS_PATH)) return JSON.parse(fs.readFileSync(PROGRESS_PATH, 'utf8'));
  return { storeId: null, done: {} };
}

export function saveProgress(p) {
  fs.writeFileSync(PROGRESS_PATH, JSON.stringify(p, null, 2));
}

const NUMERIC_KEYS = new Set(['loss_usd', 'returned_funds_usd', 'duration_s', 'upload_date']);
const BOOL_KEYS = new Set(['bridge_hack']);

/**
 * 標頭是檔案開頭的 `# key: value` 行，第一行是標題（沒有冒號）。
 *
 * 不能假設這些行是連續的：DefiLlama 有 2 個協議名稱本身含換行字元，
 * 害標題被拆成好幾行、中間還夾空行，把標頭切成兩段。
 * 所以改成掃描開頭 HEADER_SCAN_LINES 行，收集所有 `# key: value`，
 * 正文從最後一個標頭行的下一行開始。
 */
const HEADER_SCAN_LINES = 30;

export function parseCorpusFile(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const lines = raw.split(/\r?\n/);
  const attrs = {};
  const titleParts = [];
  let lastHeaderLine = -1;

  const limit = Math.min(lines.length, HEADER_SCAN_LINES);
  for (let j = 0; j < limit; j++) {
    const line = lines[j];
    if (!line.startsWith('# ')) {
      // 標頭尚未開始前的續行（被換行切開的標題）先留著，其餘略過
      if (lastHeaderLine === -1 && line.trim() !== '') titleParts.push(line.trim());
      continue;
    }
    const body = line.slice(2);
    const m = body.match(/^([a-z_0-9]+):\s*(.*)$/);
    if (!m) {
      if (lastHeaderLine === -1) titleParts.push(body.trim());
      continue;
    }
    lastHeaderLine = j;
    const [, key, rawVal] = m;
    const val = rawVal.trim();
    if (val === '' || val === 'none' || val === 'None') continue;

    if (NUMERIC_KEYS.has(key)) {
      const n = Number(val);
      if (Number.isFinite(n)) attrs[key] = n;
    } else if (BOOL_KEYS.has(key)) {
      attrs[key] = val.toLowerCase() === 'true';
    } else {
      attrs[key] = val.slice(0, 480);
    }
  }

  const title = titleParts.join(' ').replace(/\s+/g, ' ').trim();
  if (title) attrs.title = title.slice(0, 480);

  // 三批語料的日期格式不一樣，統一成數值 YYYYMMDD 才能跨來源做範圍過濾
  const d = normalizeDate(attrs.date ?? attrs.upload_date);
  if (d !== null) attrs.date_num = d;

  return { attrs, bodyStartLine: lastHeaderLine + 1, raw, charCount: raw.length };
}

/**
 * 支援三種輸入：
 *   M/D/YYYY 與其補零變體（rekt，也有一筆兩位數年份）
 *   YYYY-MM-DD（defillama）
 *   YYYYMMDD 數值（youtube 的 upload_date）
 * 無法解析就回 null，寧可少一個屬性也不要塞錯的數字進去。
 */
export function normalizeDate(v) {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();

  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return pack(+m[1], +m[2], +m[3]);

  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  if (m) {
    let y = +m[3];
    if (y < 100) y += 2000; // rekt 只有一筆兩位數年份，都是 2000 年後的事件
    return pack(y, +m[1], +m[2]);
  }

  m = s.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (m) return pack(+m[1], +m[2], +m[3]);

  return null;
}

function pack(y, mo, d) {
  if (y < 2000 || y > 2100 || mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return y * 10000 + mo * 100 + d;
}

export function listCorpusFiles(dir, exts) {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isFile() && exts.includes(path.extname(d.name).toLowerCase()))
    .map((d) => path.join(dir, d.name));
}

/**
 * 三批語料的來源設定。x-corpus 已放棄（每個幣只抓到 5–8 則，且高互動內容本身就是喊單）。
 * 路徑用絕對路徑，這樣從任何工作目錄執行都一樣。
 */
export const CORPORA = [
  { dir: path.join(ROOT, 'rekt-corpus'), exts: ['.md'], label: 'rekt' },
  { dir: path.join(ROOT, 'defillama-corpus'), exts: ['.md'], label: 'defillama' },
  { dir: path.join(ROOT, 'yt-corpus'), exts: ['.txt'], label: 'youtube' },
];
