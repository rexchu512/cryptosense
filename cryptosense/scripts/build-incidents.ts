/**
 * Build the security-incident index used by the risk card.
 *
 * Source: DefiLlama's public `/hacks` dataset — no key, no auth. It is chosen
 * over the rekt.news corpus because it carries the structured fields the card
 * needs (chain, technique, classification, amount); rekt is narrative and has
 * no machine-readable chain field.
 *
 * ⚠️ `amount` is denominated in **USD**, not millions. Verified against known
 * events: Ronin Bridge 624,000,000 · Poly Network 611,000,000 ·
 * Phemex 85,000,000 · Bybit 1,400,000,000. An earlier version multiplied by
 * 1e6 and reported Phemex as $85 trillion.
 *
 * Run:  npx tsx scripts/build-incidents.ts
 */
import fs from "node:fs";
import path from "node:path";

const API = "https://api.llama.fi/hacks";
const OUT = path.join(process.cwd(), "lib", "data", "incidents.json");

/** Sanity anchors — the build fails loudly rather than shipping wrong money. */
const EXPECTED: Record<string, number> = {
  "Ronin Bridge": 624_000_000,
  "Poly Network": 611_000_000,
  Phemex: 85_000_000,
};

type Hack = {
  date?: number;
  name?: string;
  classification?: string;
  technique?: string;
  amount?: number;
  chain?: string[] | string;
  targetType?: string;
};

type Ref = { name: string; date: string; lossUsd: number; technique?: string };
type Bucket = {
  label: string;
  count: number;
  totalLossUsd: number;
  largest: Ref | null;
  latest: Ref | null;
  topTechniques: { technique: string; count: number }[];
};

/** DefiLlama's chain strings → the keys `lib/tools/incidents.ts` looks up. */
const CHAIN_ALIASES: Record<string, string> = {
  binance: "bsc",
  "binance smart chain": "bsc",
  bnb: "bsc",
  "bnb chain": "bsc",
  ripple: "xrp",
  matic: "polygon",
  "near protocol": "near",
  "cosmos hub": "cosmos",
};

const norm = (s: string) => {
  const k = s.trim().toLowerCase();
  return CHAIN_ALIASES[k] ?? k.replace(/\s+/g, "-");
};

const ymd = (unix?: number) =>
  unix ? new Date(unix * 1000).toISOString().slice(0, 10) : "unknown";

function accumulate(
  into: Map<string, { label: string; hacks: Hack[] }>,
  key: string,
  label: string,
  h: Hack,
) {
  const cur = into.get(key) ?? { label, hacks: [] };
  cur.hacks.push(h);
  into.set(key, cur);
}

function summarise(label: string, hacks: Hack[]): Bucket {
  const withAmount = hacks.filter((h) => typeof h.amount === "number" && h.amount! > 0);
  const toRef = (h: Hack): Ref => ({
    name: h.name ?? "unknown",
    date: ymd(h.date),
    lossUsd: Math.round(h.amount ?? 0),
    ...(h.technique ? { technique: h.technique } : {}),
  });

  const largest = withAmount.length
    ? toRef(withAmount.reduce((a, b) => ((a.amount ?? 0) >= (b.amount ?? 0) ? a : b)))
    : null;
  const dated = hacks.filter((h) => typeof h.date === "number");
  const latest = dated.length
    ? toRef(dated.reduce((a, b) => ((a.date ?? 0) >= (b.date ?? 0) ? a : b)))
    : null;

  // DefiLlama files the same technique under several qualifiers — e.g. both
  // "Private Key Compromised" and "Private Key Compromised (Unknown Method)".
  // Listed side by side in the card they read as a duplicate-rendering bug, so
  // the parenthetical qualifier is dropped before counting.
  const techniques = new Map<string, number>();
  for (const h of hacks) {
    if (!h.technique) continue;
    const base = h.technique.replace(/\s*\([^)]*\)\s*$/, "").trim() || h.technique;
    techniques.set(base, (techniques.get(base) ?? 0) + 1);
  }

  return {
    label,
    count: hacks.length,
    totalLossUsd: Math.round(withAmount.reduce((s, h) => s + (h.amount ?? 0), 0)),
    largest,
    latest,
    topTechniques: [...techniques.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([technique, count]) => ({ technique, count })),
  };
}

async function main() {
  process.stdout.write(`下載 ${API} …\n`);
  const res = await fetch(API);
  if (!res.ok) throw new Error(`DefiLlama 回應 ${res.status}`);
  const hacks: Hack[] = await res.json();
  process.stdout.write(`事故 ${hacks.length} 筆\n`);

  // Fail the build rather than ship wrong money. A risk product that misstates
  // a loss by an order of magnitude is worse than one that shows nothing.
  for (const [name, expected] of Object.entries(EXPECTED)) {
    const found = hacks.find((h) => h.name === name);
    if (!found) {
      process.stdout.write(`  ! 對照事件「${name}」不在資料中，跳過驗證\n`);
      continue;
    }
    if (Math.abs((found.amount ?? 0) - expected) / expected > 0.3) {
      throw new Error(
        `金額單位檢查失敗：${name} 回傳 ${found.amount}，預期約 ${expected}。` +
          `DefiLlama 可能改了單位，請先確認再重建索引。`,
      );
    }
  }
  process.stdout.write("金額單位檢查通過（美元）\n");

  const chains = new Map<string, { label: string; hacks: Hack[] }>();
  const protocols = new Map<string, { label: string; hacks: Hack[] }>();

  for (const h of hacks) {
    if (!h.name) continue;
    const raw = Array.isArray(h.chain) ? h.chain : h.chain ? [h.chain] : [];
    // A multi-chain incident is real exposure on every chain it touched, so it
    // counts once per chain rather than being attributed to a single one.
    for (const c of raw) {
      if (typeof c === "string" && c.trim()) accumulate(chains, norm(c), c.trim(), h);
    }
    accumulate(protocols, norm(h.name), h.name.trim(), h);
  }

  const index = {
    generatedAt: new Date().toISOString(),
    source: API,
    totalIncidents: hacks.length,
    byChain: Object.fromEntries(
      [...chains].map(([k, v]) => [k, summarise(v.label, v.hacks)]),
    ),
    byProtocol: Object.fromEntries(
      [...protocols].map(([k, v]) => [k, summarise(v.label, v.hacks)]),
    ),
  };

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(index, null, 2), "utf8");

  const kb = (fs.statSync(OUT).size / 1024).toFixed(0);
  process.stdout.write(
    `\n寫出 ${OUT}\n` +
      `  鏈 ${Object.keys(index.byChain).length} 個、協議 ${Object.keys(index.byProtocol).length} 個、${kb} KB\n`,
  );
  for (const k of ["ethereum", "bsc", "solana", "bitcoin", "arbitrum"]) {
    const b = index.byChain[k];
    if (b) {
      process.stdout.write(
        `  ${k.padEnd(10)} ${String(b.count).padStart(4)} 起、最大 ${b.largest?.lossUsd.toLocaleString() ?? "-"} 美元\n`,
      );
    }
  }
}

main().catch((e) => {
  process.stderr.write(String(e?.message ?? e) + "\n");
  process.exit(1);
});
