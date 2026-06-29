import { NextResponse } from "next/server";
import { getCoinData } from "@/lib/tools/coin";
import { getCryptoNews } from "@/lib/tools/news";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const coin = await getCoinData(id);
  const news = await getCryptoNews(coin.data?.symbol);
  return NextResponse.json({ coin, news });
}
