import { NextResponse } from "next/server";
import { getMarketOverview, getFearGreedIndex } from "@/lib/tools/market";

export async function GET() {
  const [overview, fearGreed] = await Promise.all([getMarketOverview(), getFearGreedIndex()]);
  return NextResponse.json({ overview, fearGreed });
}
