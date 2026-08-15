import { NextResponse } from "next/server";
import { getPriceSeries } from "@/lib/tools/priceSeries";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const q = new URL(req.url).searchParams;
  const symbol = q.get("symbol");

  // 缺代號就無法配對交易對。猜一個會讓防呆失效，寧可明確拒絕。
  if (!symbol) {
    return NextResponse.json({ error: "symbol is required" }, { status: 400 });
  }

  const result = await getPriceSeries({
    coinId: id,
    symbol,
    spotPrice: Number(q.get("spot") ?? 0),
    isStablecoin: q.get("stable") === "1",
  });
  return NextResponse.json(result);
}
