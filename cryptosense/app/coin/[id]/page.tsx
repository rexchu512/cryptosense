import { CoinDetail } from "@/components/CoinDetail";
import { getCoinData } from "@/lib/tools/coin";
import { getCryptoNews } from "@/lib/tools/news";

export const dynamic = "force-dynamic";

export default async function CoinPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const coin = await getCoinData(id);
  const news = coin.data ? (await getCryptoNews(coin.data.symbol)).data ?? [] : [];
  return (
    <main className="mx-auto max-w-3xl p-6">
      {coin.data
        ? <CoinDetail coin={coin.data} news={news} updatedAt={new Date(coin.timestamp).toLocaleString()} />
        : <p className="text-slate-400">找不到此幣資料。</p>}
    </main>
  );
}
