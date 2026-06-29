import { MarketDashboard } from "@/components/MarketDashboard";
import { getMarketOverview, getFearGreedIndex } from "@/lib/tools/market";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [overview, fearGreed] = await Promise.all([getMarketOverview(), getFearGreedIndex()]);
  return (
    <main className="mx-auto max-w-5xl p-6">
      <h1 className="mb-4 text-xl font-bold text-white">CryptoSense · 市場總覽</h1>
      {overview.data && fearGreed.data
        ? <MarketDashboard overview={overview.data} fearGreed={fearGreed.data} />
        : <p className="text-slate-400">市場資料暫時取不到，請稍後再試。</p>}
    </main>
  );
}
