// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/tools/incidents", () => ({ getIncidentSummary: vi.fn() }));
vi.mock("@/lib/ai/riskCard", async (orig) => ({
  ...(await orig<typeof import("@/lib/ai/riskCard")>()),
  streamRiskCard: vi.fn(),
}));

import { POST } from "./route";
import { getIncidentSummary } from "@/lib/tools/incidents";
import { streamRiskCard } from "@/lib/ai/riskCard";

const body = {
  symbol: "ETH",
  coinId: "ethereum",
  question: "現在進場風險高嗎？",
  answer: "以太坊近期波動放大。",
  sources: [{ n: 1, kind: "market", title: "快照", meta: "CoinGecko" }],
};

const card = {
  stance: "偏高風險",
  confidence: "中",
  headline: "波動放大，進場前先確認部位規模。",
  pros: [{ text: "流動性充足", sourceId: 1 }, { text: "開發活躍", sourceId: null }],
  risks: [{ text: "波動放大", sourceId: 1 }, { text: "生態有資安事件", sourceId: null }],
};

function req(b: unknown) {
  return new Request("http://x/api/risk-card", {
    method: "POST",
    body: JSON.stringify(b),
    headers: { "Content-Type": "application/json" },
  });
}

async function lines(res: Response) {
  const text = await res.text();
  return text.trim().split("\n").filter(Boolean).map((l) => JSON.parse(l));
}

function mockStream(partials: unknown[]) {
  vi.mocked(streamRiskCard).mockReturnValue({
    partialOutputStream: (async function* () {
      for (const p of partials) yield p;
    })(),
  } as never);
}

beforeEach(() => {
  vi.mocked(getIncidentSummary).mockReset();
  vi.mocked(streamRiskCard).mockReset();
});

describe("POST /api/risk-card", () => {
  it("emits the incident block first, then the streaming card", async () => {
    const incidents = { scope: "chain", label: "Ethereum", count: 273 };
    vi.mocked(getIncidentSummary).mockReturnValue(incidents as never);
    mockStream([{ stance: "偏高風險" }, card]);

    const out = await lines(await POST(req(body)));
    expect(out[0]).toEqual({ type: "incidents", data: incidents });
    expect(out[1].type).toBe("card");
    expect(out.at(-1)).toEqual({ type: "done" });
    expect(out.some((l) => l.type === "card" && l.data.pros?.length === 2)).toBe(true);
  });

  it("passes the coin through to the incident lookup", async () => {
    vi.mocked(getIncidentSummary).mockReturnValue(null);
    mockStream([card]);
    await lines(await POST(req(body)));
    expect(getIncidentSummary).toHaveBeenCalledWith({ symbol: "ETH", coinId: "ethereum" });
  });

  it("reports no incident data rather than a zero count", async () => {
    vi.mocked(getIncidentSummary).mockReturnValue(null);
    mockStream([card]);
    const out = await lines(await POST(req(body)));
    expect(out[0]).toEqual({ type: "incidents", data: null });
  });

  it("rejects an over-long symbol", async () => {
    const res = await POST(req({ ...body, symbol: "X".repeat(17) }));
    expect(res.status).toBe(400);
    expect(streamRiskCard).not.toHaveBeenCalled();
  });

  it("rejects an over-long coinId", async () => {
    const res = await POST(req({ ...body, coinId: "x".repeat(65) }));
    expect(res.status).toBe(400);
  });

  it("rejects a non-array sources field", async () => {
    const res = await POST(req({ ...body, sources: "nope" }));
    expect(res.status).toBe(400);
  });

  it("rejects a missing answer", async () => {
    const res = await POST(req({ ...body, answer: "" }));
    expect(res.status).toBe(400);
  });

  it("ends the stream with an error marker when generation fails mid-flight", async () => {
    // The card is an enhancement. When it fails the client keeps the prose
    // answer and simply shows no card — it must never render a half card.
    vi.mocked(getIncidentSummary).mockReturnValue(null);
    vi.mocked(streamRiskCard).mockReturnValue({
      partialOutputStream: (async function* () {
        yield { stance: "中性" };
        throw new Error("schema drift");
      })(),
    } as never);

    const out = await lines(await POST(req(body)));
    expect(out.at(-1)).toEqual({ type: "error" });
    expect(out.some((l) => l.type === "done")).toBe(false);
  });

  it("returns 400 on malformed JSON instead of throwing", async () => {
    const res = await POST(
      new Request("http://x/api/risk-card", { method: "POST", body: "{oops" }),
    );
    expect(res.status).toBe(400);
  });
});
