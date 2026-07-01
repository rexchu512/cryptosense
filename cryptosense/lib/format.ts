export const pct = (n: number) => `${n >= 0 ? "▲" : "▼"} ${Math.abs(n).toFixed(2)}%`;
export const usdCompact = (n: number) =>
  new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 2, style: "currency", currency: "USD" }).format(n);
export const numCompact = (n: number) =>
  new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 2 }).format(n);
export const changeClass = (n: number) => (n >= 0 ? "text-up" : "text-down-soft");
