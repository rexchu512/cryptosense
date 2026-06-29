import Link from "next/link";
import type { CoinData } from "@/lib/tools/coin";
import type { NewsItem } from "@/lib/tools/news";
import { pct, changeClass, usdCompact } from "@/lib/format";

const sent: Record<string, string> = { positive: "利多", negative: "利空", neutral: "中性" };
const sentClass = (s: string) => (s === "negative" ? "text-red-500" : s === "positive" ? "text-green-500" : "text-slate-400");

export function CoinDetail({ coin, news, updatedAt }: { coin: CoinData; news: NewsItem[]; updatedAt: string }) {
  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-wide text-slate-400">{coin.name} · {coin.symbol}</div>
          <div className="text-3xl font-bold text-white">${coin.price.toLocaleString()}{" "}
            <span className={`text-sm ${changeClass(coin.change24h)}`}>{pct(coin.change24h)} (24h)</span></div>
        </div>
        <div className="text-right text-xs text-slate-400">資料更新<br />{updatedAt}</div>
      </div>

      <div className="flex gap-3 text-sm text-slate-300">
        <div>市值 <span className="text-white">{usdCompact(coin.marketCap)}</span></div>
        <div>24h 量 <span className="text-white">{usdCompact(coin.volume24h)}</span></div>
      </div>

      <section className="rounded-lg border border-slate-800 bg-slate-900 p-3">
        <h2 className="mb-2 font-semibold text-white">📰 新聞與情緒</h2>
        {news.length ? news.map((n, i) => (
          <div key={i} className="border-t border-slate-800 py-1 text-sm">
            <a className="text-sky-400 hover:underline" href={n.url} target="_blank" rel="noopener noreferrer">{n.title}</a>{" "}
            <span data-testid={`news-sentiment-${i}`} className={sentClass(n.sentiment)}>{sent[n.sentiment]}</span>
          </div>
        )) : <p className="text-slate-400">近期無新聞。</p>}
        <div className="mt-1 text-[10px] text-sky-400">來源：CryptoPanic · {updatedAt}</div>
      </section>

      <Link href={`/coin/${coin.id}?chat=1`} className="block w-full rounded-lg bg-blue-600 py-3 text-center font-semibold text-white">
        💬 針對 {coin.symbol} 問 AI：「我現在該進場嗎？」</Link>
    </div>
  );
}
