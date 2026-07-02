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
    <main className="cs-wrap py-8 lg:py-12">
      {coin.data
        ? (
          <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-8">
            <CoinDetail
              coin={coin.data}
              news={newsRes?.data ?? []}
              newsError={newsRes?.error}
              updatedAt={new Date(coin.timestamp).toLocaleString("zh-TW")}
            />
            <div id="ai-chat" className="scroll-mt-20 lg:sticky lg:top-20">
              <Chat coinId={coin.data.id} symbol={coin.data.symbol} />
            </div>
          </div>
        )
        : <p className="py-16 text-center text-cb-muted">找不到此幣資料。</p>}
    </main>
  );
}
