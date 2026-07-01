// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/tools/search", () => ({ searchCoins: vi.fn() }));

import { GET } from "./route";
import { searchCoins } from "@/lib/tools/search";

describe("GET /api/search", () => {
  it("passes the q query param through to searchCoins", async () => {
    vi.mocked(searchCoins).mockResolvedValue({ data: [], source: "CoinGecko", timestamp: "t" });
    const res = await GET(new NextRequest("http://x/api/search?q=eth"));
    expect(searchCoins).toHaveBeenCalledWith("eth");
    const body = await res.json();
    expect(body.data).toEqual([]);
  });
  it("defaults to an empty query string when q is missing", async () => {
    vi.mocked(searchCoins).mockResolvedValue({ data: [], source: "CoinGecko", timestamp: "t" });
    await GET(new NextRequest("http://x/api/search"));
    expect(searchCoins).toHaveBeenCalledWith("");
  });
});
