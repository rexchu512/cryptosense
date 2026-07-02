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

export function CoinDetail({ coin, news, updatedAt, newsError }: { coin: CoinData; news: NewsItem[]; updatedAt: string; newsError?: string }) {
  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between">
        <div className="flex items-center gap-3">
          <CoinIcon image={coin.image} symbol={coin.symbol} size={36} />
          <div>
            <div className="text-[10px] uppercase tracking-wide text-cb-muted">{coin.name} · {coin.symbol}</div>
            <div className="font-mono text-3xl font-medium tabular-nums text-ink">
              ${coin.price.toLocaleString("en-US")}{" "}
              <span data-testid="coin-change" className={`text-sm ${changeClass(coin.change24h)}`}>{pct(coin.change24h)} (24h)</span>
            </div>
          </div>
        </div>
        <div className="text-right text-xs text-cb-muted">資料更新<br />{updatedAt}</div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-hairline p-3">
          <div className="text-[10px] uppercase text-cb-muted">市值排名</div>
          <div className="font-mono text-[15px] font-medium text-ink">{coin.marketCapRank ? `#${coin.marketCapRank}` : "—"}</div>
        </div>
        <div className="rounded-xl border border-hairline p-3">
          <div className="text-[10px] uppercase text-cb-muted">市值</div>
          <div className="font-mono text-[15px] font-medium text-ink">{usdCompact(coin.marketCap)}</div>
        </div>
        <div className="rounded-xl border border-hairline p-3">
          <div className="text-[10px] uppercase text-cb-muted">24H 量</div>
          <div className="font-mono text-[15px] font-medium text-ink">{usdCompact(coin.volume24h)}</div>
        </div>
        <div className="rounded-xl border border-hairline p-3">
          <div className="text-[10px] uppercase text-cb-muted">流通量</div>
          <div className="font-mono text-[13px] font-medium text-ink">{numCompact(coin.circulatingSupply)} {coin.symbol}</div>
        </div>
      </div>
      <div className="text-[10px] text-cb-primary">資料來源：CoinGecko · {updatedAt}</div>

      <PriceTrendChart symbol={coin.symbol} data={coin.spark7d} change7d={coin.change7d} />

      <section className="rounded-2xl border border-hairline p-4">
        <h2 className="mb-2 flex items-center gap-2 font-semibold text-ink">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="text-brand-strong">
            <path d="M4 4h13v16H6a2 2 0 0 1-2-2V4Z" /><path d="M17 8h2a1 1 0 0 1 1 1v9a2 2 0 0 1-2 2" /><path d="M8 8h5M8 12h5M8 16h3" />
          </svg>
          近期新聞
        </h2>
        {newsError
          ? <p className="text-cb-muted">新聞暫時無法載入，請稍後再試。</p>
          : news.length ? news.map((n, i) => {
            const dateStr = safeLocalDate(n.publishedAt);
            return (
              <div key={n.url ?? i} className="border-t border-hairline-soft py-1 text-sm">
                <a className="text-ink hover:underline" href={n.url} target="_blank" rel="noopener noreferrer">{n.title}</a>
                {dateStr && <span className="ml-2 text-xs text-cb-muted">{dateStr}</span>}
              </div>
            );
          }) : <p className="text-cb-muted">近期無新聞。</p>}
        <div className="mt-1 text-[10px] text-cb-muted">來源：CoinTelegraph · {updatedAt}</div>
      </section>

      <a
        href="#ai-chat"
        className="flex items-center justify-center gap-2 rounded-2xl border border-hairline bg-soft py-3 text-sm font-medium text-ink hover:bg-strong"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="text-brand-strong">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z" />
        </svg>
        針對 {coin.symbol} 問 AI：「我現在該進場嗎？」
      </a>
    </div>
  );
}
