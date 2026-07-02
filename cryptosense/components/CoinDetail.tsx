import Link from "next/link";
import type { CoinData } from "@/lib/tools/coin";
import type { NewsItem } from "@/lib/tools/news";
import { pct, changeClass, usdCompact, numCompact } from "@/lib/format";
import { CoinIcon } from "./CoinIcon";
import { PriceTrendChart } from "./PriceTrendChart";

function safeLocalDate(pubDate: string): string {
  try {
    const d = new Date(pubDate);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString("zh-TW");
  } catch {
    return "";
  }
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-hairline bg-canvas p-4 shadow-sm">
      <div className="text-[10px] uppercase tracking-wide text-cb-muted">{label}</div>
      <div className="mt-1 font-mono text-[15px] font-semibold text-ink">{value}</div>
    </div>
  );
}

export function CoinDetail({ coin, news, updatedAt, newsError }: { coin: CoinData; news: NewsItem[]; updatedAt: string; newsError?: string }) {
  return (
    <div className="min-w-0 space-y-6">
      {/* Breadcrumb */}
      <nav aria-label="breadcrumb" className="flex items-center gap-2 text-[13px] text-cb-muted">
        <Link href="/" className="font-medium text-brand-strong hover:underline">市場總覽</Link>
        <span aria-hidden="true">›</span>
        <span>{coin.name}</span>
      </nav>

      {/* Price hero */}
      <div className="flex flex-col gap-4 border-b border-hairline-soft pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-center gap-4">
          <CoinIcon image={coin.image} symbol={coin.symbol} size={46} />
          <div>
            <div className="text-[11px] font-medium uppercase tracking-wide text-cb-muted">{coin.name} · {coin.symbol}</div>
            <div className="mt-1 font-mono text-3xl font-semibold tabular-nums text-ink sm:text-4xl">
              ${coin.price.toLocaleString("en-US")}{" "}
              <span data-testid="coin-change" className={`text-sm font-semibold ${changeClass(coin.change24h)}`}>
                {pct(coin.change24h)}
              </span>{" "}
              <span className="text-sm font-normal text-cb-muted">(24h)</span>
            </div>
          </div>
        </div>
        <div className="font-mono text-[11px] leading-relaxed text-cb-muted sm:text-right">
          資料更新<br />{updatedAt}
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="市值排名" value={coin.marketCapRank ? `#${coin.marketCapRank}` : "—"} />
        <StatCard label="市值" value={usdCompact(coin.marketCap)} />
        <StatCard label="24H 量" value={usdCompact(coin.volume24h)} />
        <StatCard label="流通量" value={`${numCompact(coin.circulatingSupply)} ${coin.symbol}`} />
      </div>
      <div className="-mt-2 font-mono text-[11px] text-brand-strong">
        資料來源：CoinGecko · {updatedAt} · Powered by CoinGecko API
      </div>

      <PriceTrendChart symbol={coin.symbol} data={coin.spark7d} change7d={coin.change7d} />

      {/* News */}
      <section className="rounded-2xl border border-hairline bg-canvas p-5 shadow-sm transition-shadow hover:shadow-md">
        <h2 className="mb-1 flex items-center gap-2 font-heading text-base font-bold text-ink">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="text-brand-strong">
            <path d="M4 4h13v16H6a2 2 0 0 1-2-2V4Z" /><path d="M17 8h2a1 1 0 0 1 1 1v9a2 2 0 0 1-2 2" /><path d="M8 8h5M8 12h5M8 16h3" />
          </svg>
          近期新聞
        </h2>
        {newsError
          ? <p className="py-3 text-sm text-cb-muted">新聞暫時無法載入，請稍後再試。</p>
          : news.length ? news.map((n, i) => {
            const dateStr = safeLocalDate(n.publishedAt);
            return (
              <div key={n.url ?? i} className="border-t border-hairline-soft py-3 first:border-t-0 first:pt-2">
                <a className="block text-[15px] font-medium text-ink hover:underline" href={n.url} target="_blank" rel="noopener noreferrer">{n.title}</a>
                {dateStr && <div className="mt-1 font-mono text-xs text-cb-muted">{dateStr}</div>}
              </div>
            );
          }) : <p className="py-3 text-sm text-cb-muted">近期無新聞。</p>}
        <div className="mt-3 font-mono text-[10px] text-cb-muted">來源：CoinTelegraph · {updatedAt}</div>
      </section>

      <a
        href="#ai-chat"
        className="flex items-center justify-center gap-2 rounded-2xl border border-hairline bg-soft py-3.5 text-sm font-medium text-ink shadow-sm transition-colors hover:bg-strong lg:hidden"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="text-brand-strong">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z" />
        </svg>
        針對 {coin.symbol} 問 AI：「我現在該進場嗎？」
      </a>
    </div>
  );
}
