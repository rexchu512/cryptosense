import { Chat } from "@/components/Chat";
import { CoinDetail } from "@/components/CoinDetail";
import { getCoinData } from "@/lib/tools/coin";
import { getCryptoNews } from "@/lib/tools/news";

export const dynamic = "force-dynamic";

export default async function CoinPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const coin = await getCoinData(id);
  const newsRes = coin.data ? await getCryptoNews(coin.data.symbol) : null;
  return (
    <main className="mx-auto max-w-3xl p-6">
      {coin.data
        ? <>
            <CoinDetail coin={coin.data} news={newsRes?.data ?? []} newsError={newsRes?.error} updatedAt={new Date(coin.timestamp).toLocaleString()} />
            <div className="mt-6">
              <Chat coinId={coin.data.id} symbol={coin.data.symbol} />
            </div>
          </>
        : <p className="text-slate-400">找不到此幣資料。</p>}
    </main>
  );
}
