import { type NextRequest, NextResponse } from "next/server";
import { searchCoins } from "@/lib/tools/search";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q") ?? "";
  const result = await searchCoins(q);
  return NextResponse.json(result);
}
