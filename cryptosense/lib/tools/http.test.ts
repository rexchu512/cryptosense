// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ok, fail, cachedFetch, __clearCache } from "./http";

beforeEach(() => __clearCache());

describe("ok/fail", () => {
  it("ok wraps data with source + ISO timestamp", () => {
    const r = ok({ x: 1 }, "CoinGecko");
    expect(r.data).toEqual({ x: 1 });
    expect(r.source).toBe("CoinGecko");
    expect(() => new Date(r.timestamp).toISOString()).not.toThrow();
  });
  it("fail returns null data + error", () => {
    expect(fail("CoinGecko", "boom")).toMatchObject({ data: null, error: "boom" });
  });
});

describe("cachedFetch", () => {
  it("caches within TTL (single network call)", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ v: 1 }) });
    vi.stubGlobal("fetch", fetchMock);
    await cachedFetch("http://x", { ttlMs: 1000 });
    await cachedFetch("http://x", { ttlMs: 1000 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("returns stale value on later failure", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ v: 1 }) })
      .mockResolvedValueOnce({ ok: false, status: 429 });
    vi.stubGlobal("fetch", fetchMock);
    const a = await cachedFetch("http://y", { ttlMs: 0 });   // 寫入快取
    const b = await cachedFetch("http://y", { ttlMs: 0 });   // 429 → 回 stale
    expect(a).toEqual({ v: 1 });
    expect(b).toEqual({ v: 1 });
  });
  it("throws when failing with no cached value", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    await expect(cachedFetch("http://z")).rejects.toThrow("HTTP 500");
  });
});
