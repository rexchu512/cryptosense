// 證明：原本的重試迴圈接不到「fetch 丟出的例外」，網路一抖就零重試直接失敗。
import http from 'node:http';

let attempts = 0;

/** 原版：只看 HTTP 狀態碼，fetch 自己丟例外時整個迴圈被跳過 */
async function apiOld(url, tries = 5) {
  for (let t = 0; t < tries; t++) {
    attempts++;
    const res = await fetch(url); // 這行丟例外 → 直接離開函式，t 永遠不會前進
    if (res.ok) return res.json();
    if (res.status === 429 || res.status >= 500) { await new Promise((r) => setTimeout(r, 5)); continue; }
    throw new Error(`${res.status}`);
  }
  throw new Error('重試耗盡');
}

/** 修正版：把 fetch 包進 try/catch，網路層錯誤也退避重試 */
async function apiNew(url, tries = 5) {
  let last;
  for (let t = 0; t < tries; t++) {
    attempts++;
    try {
      const res = await fetch(url);
      if (res.ok) return res.json();
      if (res.status === 429 || res.status >= 500) {
        await res.text().catch(() => {});
        await new Promise((r) => setTimeout(r, 5));
        continue;
      }
      throw new Error(`HTTP ${res.status}`);
    } catch (e) {
      if (e instanceof Error && e.message.startsWith('HTTP ')) throw e;
      last = e;
      await new Promise((r) => setTimeout(r, 5));
    }
  }
  throw new Error(`重試耗盡: ${last?.message}`);
}

// 指向一個沒人在聽的埠，保證 fetch 丟出網路層例外
const DEAD = 'http://127.0.0.1:39999/';

attempts = 0;
try { await apiOld(DEAD); } catch (e) { console.log(`原版   丟出 "${e.message}"  實際嘗試次數=${attempts}`); }
const oldAttempts = attempts;

attempts = 0;
try { await apiNew(DEAD); } catch (e) { console.log(`修正版 丟出 "${e.message.slice(0, 40)}"  實際嘗試次數=${attempts}`); }
const newAttempts = attempts;

// 再確認修正版遇到「先失敗、後恢復」的情況能救回來
let hits = 0;
const server = http.createServer((req, res) => {
  hits++;
  if (hits <= 2) { req.socket.destroy(); return; } // 前兩次直接砍連線
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ recovered: true }));
});
await new Promise((r) => server.listen(39998, r));
attempts = 0;
let recovered = null;
try { recovered = await apiNew('http://127.0.0.1:39998/'); } catch (e) { recovered = { error: e.message }; }
server.close();
console.log(`修正版 在連線被砍兩次後: ${JSON.stringify(recovered)}  嘗試次數=${attempts}`);

console.log('');
const pass = oldAttempts === 1 && newAttempts === 5 && recovered?.recovered === true;
console.log(pass
  ? '確認：原版網路層錯誤只試 1 次就放棄；修正版會重試並能從中斷恢復。'
  : `未如預期（old=${oldAttempts}, new=${newAttempts}, recovered=${JSON.stringify(recovered)}）`);
process.exit(pass ? 0 : 1);
