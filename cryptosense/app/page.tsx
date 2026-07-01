import { MarketDashboard } from "@/components/MarketDashboard";
import { getMarketOverview, getFearGreedIndex } from "@/lib/tools/market";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [overview, fearGreed] = await Promise.all([getMarketOverview(), getFearGreedIndex()]);
  return (
    <main className="mx-auto max-w-5xl p-6">
      <p className="mb-4 text-xs text-cb-muted">市場總覽 · 分析型摘要</p>
      {overview.data && fearGreed.data
        ? <MarketDashboard overview={overview.data} fearGreed={fearGreed.data} />
        : <p className="text-cb-muted">市場資料暫時取不到，請稍後再試。</p>}
    </main>
  );
}
