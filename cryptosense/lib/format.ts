export const pct = (n: number) => `${n >= 0 ? "▲" : "▼"} ${Math.abs(n).toFixed(2)}%`;

// Deterministic compact number formatting. We intentionally avoid
// Intl.NumberFormat's `notation: "compact"` because Node's ICU and the
// browser's ICU disagree on trailing-zero handling (server "$73.20B" vs
// client "$73.2B"), which triggers a React hydration mismatch.
function compact(n: number): string {
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  const units: [number, string][] = [
    [1e12, "T"],
    [1e9, "B"],
    [1e6, "M"],
    [1e3, "K"],
  ];
  for (const [div, suffix] of units) {
    if (abs >= div) {
      return `${sign}${(abs / div).toFixed(2).replace(/\.?0+$/, "")}${suffix}`;
    }
  }
  return `${sign}${abs.toFixed(0)}`;
}

export const usdCompact = (n: number) => `$${compact(n)}`;
export const numCompact = (n: number) => compact(n);
export const changeClass = (n: number) => (n >= 0 ? "text-up" : "text-down-soft");
