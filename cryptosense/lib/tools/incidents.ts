/**
 * Security-incident lookup for the risk card.
 *
 * This is a table lookup, not a retrieval. The card needs settled facts — how
 * many incidents, how large, by what technique — and semantic search cannot
 * count. The index is built ahead of time by `scripts/build-incidents.ts` from
 * DefiLlama's public hacks dataset; at request time this module only reads it.
 *
 * The whole module is pure and synchronous so the card route pays no latency
 * for it.
 */
import "server-only";
import indexJson from "@/lib/data/incidents.json";

export type IncidentRef = {
  name: string;
  date: string; // YYYY-MM-DD
  lossUsd: number;
  technique?: string;
};

export type IncidentBucket = {
  label: string;
  count: number;
  totalLossUsd: number;
  largest: IncidentRef | null;
  latest: IncidentRef | null;
  topTechniques: { technique: string; count: number }[];
};

export type IncidentIndex = {
  generatedAt: string;
  totalIncidents: number;
  byChain: Record<string, IncidentBucket>;
  byProtocol: Record<string, IncidentBucket>;
};

export type IncidentSummary = IncidentBucket & { scope: "chain" | "protocol" };

type Target = { kind: "chain" | "protocol"; key: string };

/**
 * Which bucket answers "what is the security history around this coin".
 *
 * For an L1 the honest answer is its chain — an ETH holder is exposed to the
 * Ethereum ecosystem. For a protocol token it is that protocol. ERC-20 meme
 * tokens (PEPE, SHIB) carry their host chain's risk and nothing of their own,
 * so they point at Ethereum rather than at a bucket that does not exist.
 *
 * Keys are lowercase and cover both the ticker and the CoinGecko id, because
 * callers have one, the other, or both.
 */
const TARGETS: Record<string, Target[]> = {};
function map(target: Target | Target[], ...aliases: string[]) {
  const list = Array.isArray(target) ? target : [target];
  for (const a of aliases) TARGETS[a.toLowerCase()] = list;
}

const chain = (key: string): Target => ({ kind: "chain", key });
const protocol = (key: string): Target => ({ kind: "protocol", key });

map(chain("bitcoin"), "btc", "bitcoin");
map(chain("ethereum"), "eth", "ethereum");
map(chain("solana"), "sol", "solana");
map(chain("bsc"), "bnb", "binancecoin", "binance-coin");
map(chain("xrp"), "xrp", "ripple");
map(chain("dogecoin"), "doge", "dogecoin");
map(chain("cardano"), "ada", "cardano");
map(chain("avalanche"), "avax", "avalanche-2", "avalanche");
map(chain("polkadot"), "dot", "polkadot");
map(chain("ton"), "ton", "the-open-network", "toncoin");
map(chain("sui"), "sui");
map(chain("aptos"), "apt", "aptos");
map(chain("arbitrum"), "arb", "arbitrum");
map(chain("optimism"), "op", "optimism");
map(chain("near"), "near", "near-protocol");
map(chain("cosmos"), "atom", "cosmos", "cosmos-hub");
map(chain("litecoin"), "ltc", "litecoin");
map(chain("polygon"), "matic", "matic-network", "pol", "polygon-ecosystem-token");
map(chain("tron"), "trx", "tron");
map(chain("filecoin"), "fil", "filecoin");
map(chain("injective"), "inj", "injective-protocol", "injective");
map(chain("sei"), "sei", "sei-network");
map(chain("celestia"), "tia", "celestia");
map(chain("hyperliquid"), "hype", "hyperliquid");
map(chain("base"), "base");
// ERC-20s: their security surface is the host chain's.
map(chain("ethereum"), "pepe", "shib", "shiba-inu");
// Protocol tokens: the protocol is the sharpest answer, but many have no
// incident filed under their own name. Falling back to the host chain still
// tells the holder something true about their exposure, and the card labels
// the scope, so a chain answer never reads as a protocol answer.
map([protocol("uniswap"), chain("ethereum")], "uni", "uniswap");
map([protocol("aave"), chain("ethereum")], "aave");
map([protocol("chainlink"), chain("ethereum")], "link", "chainlink");
map([protocol("curve"), chain("ethereum")], "crv", "curve-dao-token");
map([protocol("compound"), chain("ethereum")], "comp", "compound-governance-token");
map([protocol("lido"), chain("ethereum")], "ldo", "lido-dao");
map([protocol("maker"), chain("ethereum")], "mkr", "maker");

export const DEFAULT_INDEX = indexJson as unknown as IncidentIndex;

/**
 * Look up the incident history for a coin.
 *
 * Returns `null` — never a zero-count bucket — when nothing is known. "We have
 * no record" and "it has never been attacked" are different claims, and a risk
 * product must not upgrade the first into the second.
 */
export function getIncidentSummary(
  coin: { symbol?: string; coinId?: string },
  index: IncidentIndex = DEFAULT_INDEX,
): IncidentSummary | null {
  const keys = [coin.symbol, coin.coinId]
    .filter((k): k is string => typeof k === "string" && k.length > 0)
    .map((k) => k.toLowerCase());

  for (const k of keys) {
    for (const target of TARGETS[k] ?? []) {
      const bucket =
        target.kind === "chain" ? index.byChain?.[target.key] : index.byProtocol?.[target.key];
      if (bucket) return { ...bucket, scope: target.kind };
    }
  }
  return null;
}
