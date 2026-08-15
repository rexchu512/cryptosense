// @vitest-environment node
import { describe, it, expect } from "vitest";
import { getIncidentSummary, type IncidentIndex } from "./incidents";

const index: IncidentIndex = {
  generatedAt: "2026-08-15T00:00:00.000Z",
  totalIncidents: 4,
  byChain: {
    ethereum: {
      label: "Ethereum",
      count: 275,
      totalLossUsd: 3_000_000_000,
      largest: {
        name: "Ronin Bridge",
        date: "2022-03-23",
        lossUsd: 624_000_000,
        technique: "Private Key Compromised",
      },
      latest: { name: "Some Protocol", date: "2026-07-01", lossUsd: 1_000_000 },
      topTechniques: [
        { technique: "Private Key Compromised", count: 45 },
        { technique: "Reentrancy", count: 19 },
      ],
    },
    solana: {
      label: "Solana",
      count: 37,
      totalLossUsd: 500_000_000,
      largest: null,
      latest: null,
      topTechniques: [],
    },
  },
  byProtocol: {
    uniswap: {
      label: "Uniswap",
      count: 2,
      totalLossUsd: 8_000_000,
      largest: {
        name: "Uniswap",
        date: "2023-04-01",
        lossUsd: 8_000_000,
        technique: "Phishing",
      },
      latest: { name: "Uniswap", date: "2023-04-01", lossUsd: 8_000_000 },
      topTechniques: [{ technique: "Phishing", count: 2 }],
    },
  },
};

describe("getIncidentSummary", () => {
  it("resolves a layer-1 coin to its chain summary", () => {
    const s = getIncidentSummary({ symbol: "ETH", coinId: "ethereum" }, index);
    expect(s).not.toBeNull();
    expect(s!.scope).toBe("chain");
    expect(s!.label).toBe("Ethereum");
    expect(s!.count).toBe(275);
    expect(s!.largest?.lossUsd).toBe(624_000_000);
  });

  it("resolves a protocol token to its protocol summary, not a chain", () => {
    const s = getIncidentSummary({ symbol: "UNI", coinId: "uniswap" }, index);
    expect(s!.scope).toBe("protocol");
    expect(s!.label).toBe("Uniswap");
    expect(s!.count).toBe(2);
  });

  it("is case-insensitive on the symbol", () => {
    expect(getIncidentSummary({ symbol: "eth" }, index)!.label).toBe("Ethereum");
  });

  it("falls back to coinId when the symbol is unknown", () => {
    expect(getIncidentSummary({ coinId: "solana" }, index)!.label).toBe("Solana");
  });

  it("returns null for a coin with no mapping at all", () => {
    expect(getIncidentSummary({ symbol: "ZZZZ", coinId: "not-a-coin" }, index)).toBeNull();
  });

  it("returns null — never a zero-count summary — when the coin maps to a key the index lacks", () => {
    // TIA maps to celestia, which has no recorded incidents. "No data" and
    // "zero incidents" are different claims; the card must not assert the
    // second when it only knows the first.
    const s = getIncidentSummary({ symbol: "TIA", coinId: "celestia" }, index);
    expect(s).toBeNull();
  });

  it("returns null when given nothing to look up", () => {
    expect(getIncidentSummary({}, index)).toBeNull();
  });

  it("falls back to the host chain when a protocol token has no incidents of its own", () => {
    // AAVE has no incident filed under its own name, but an AAVE holder is
    // still exposed to Ethereum. Reporting the chain (clearly labelled as the
    // chain) beats reporting nothing.
    const s = getIncidentSummary({ symbol: "AAVE", coinId: "aave" }, index);
    expect(s).not.toBeNull();
    expect(s!.scope).toBe("chain");
    expect(s!.label).toBe("Ethereum");
  });

  it("prefers the protocol over its host chain when the protocol has its own record", () => {
    const s = getIncidentSummary({ symbol: "UNI" }, index);
    expect(s!.scope).toBe("protocol");
    expect(s!.label).toBe("Uniswap");
  });

  it("tolerates an index missing optional aggregates", () => {
    const s = getIncidentSummary({ symbol: "SOL" }, index);
    expect(s!.largest).toBeNull();
    expect(s!.topTechniques).toEqual([]);
  });
});
