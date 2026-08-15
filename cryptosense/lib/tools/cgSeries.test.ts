// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getDailyCloses } from "./cgSeries";
import { __clearCache } from "./http";

const DAY = 86_400_000;
const T0 = Date.UTC(2026, 0, 1);

function stub(prices: [number, number][]) {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ prices }) }));
}

beforeEach(() => __clearCache());
afterEach(() => vi.useRealTimers());

describe("getDailyCloses", () => {
  it("drops the trailing partial day so today's moving price cannot skew indicators", async () => {
    vi.useFakeTimers();
    // 現在是第 3 天的中午 —— 第 3 個點是當日還在變動的價格
    vi.setSystemTime(new Date(T0 + 2 * DAY + DAY / 2));
    stub([[T0, 10], [T0 + DAY, 11], [T0 + 2 * DAY + DAY / 2, 12]]);

    const r = await getDailyCloses("monero");

    expect(r.data).toHaveLength(2);
    expect(r.data?.at(-1)).toEqual({ time: T0 + DAY, close: 11 });
  });

  it("reports rate limiting as an outage instead of as an empty series", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 429 }));

    const r = await getDailyCloses("monero");

    expect(r.data).toBeNull();
    expect(r.code).toBe("unavailable");
  });
});
