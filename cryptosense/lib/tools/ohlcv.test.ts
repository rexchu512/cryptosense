// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getOHLCV } from "./ohlcv";
import { __clearCache } from "./http";

const DAY = 86_400_000;

/** Binance kline row: [openTime, o, h, l, c, volume, closeTime, ...] */
function row(openTime: number, close: number) {
  return [openTime, "100", "110", "90", String(close), "1234.5", openTime + DAY - 1,
    "0", 0, "0", "0", "0"];
}

function stubKlines(rows: unknown[][]) {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(rows) }));
}

beforeEach(() => __clearCache());
afterEach(() => vi.useRealTimers());

describe("getOHLCV", () => {
  it("drops the final candle while it is still open", async () => {
    const t0 = Date.UTC(2026, 0, 1);
    vi.useFakeTimers();
    // 停在第 3 根 K 線的中間 —— 那根還沒收盤
    vi.setSystemTime(new Date(t0 + 2 * DAY + DAY / 2));
    stubKlines([row(t0, 10), row(t0 + DAY, 11), row(t0 + 2 * DAY, 12)]);

    const r = await getOHLCV("BTC");

    expect(r.data?.candles).toHaveLength(2);
    expect(r.data?.candles.at(-1)?.close).toBe(11);
  });

  it("flags a coin with no Binance pair as unlisted, not as an outage", async () => {
    // Binance 對不存在的交易對回 400（code -1121 Invalid symbol）
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 400 }));

    const r = await getOHLCV("NOSUCHCOIN");

    expect(r.data).toBeNull();
    expect(r.code).toBe("unlisted");
  });

  it("flags an upstream outage as unavailable so the UI can say so", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 503 }));

    const r = await getOHLCV("BTC");

    expect(r.data).toBeNull();
    expect(r.code).toBe("unavailable");
  });
});
