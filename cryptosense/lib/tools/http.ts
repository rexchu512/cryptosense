import "server-only";
import type { ToolResult } from "./types";

export function ok<T>(data: T, source: string): ToolResult<T> {
  return { data, source, timestamp: new Date().toISOString() };
}
/** Always returns `data: null`; the generic `T` only makes the result assignable to
 *  a caller's `ToolResult<T>` return type. Consumers must null-check `.data` regardless. */
export function fail<T = null>(source: string, error: string): ToolResult<T> {
  return { data: null, source, timestamp: new Date().toISOString(), error };
}

const cache = new Map<string, { at: number; value: any }>();
export function __clearCache() { cache.clear(); }

/** 共用核心：快取邏輯 + TTL + stale fallback；parse 決定 json 或 text */
async function cachedRaw<T>(
  url: string,
  opts: { ttlMs?: number; headers?: Record<string, string> },
  parse: (res: Response) => Promise<T>,
): Promise<T> {
  const { ttlMs = 60_000, headers } = opts;
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < ttlMs) return hit.value as T;
  try {
    const res = await fetch(url, { headers: { accept: "application/json", ...headers } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const value = await parse(res);
    cache.set(url, { at: Date.now(), value });
    return value;
  } catch (e) {
    if (hit) return hit.value as T; // stale fallback
    throw e;
  }
}

/** 快取 JSON 回應（原有行為，簽名不變） */
export async function cachedFetch(url: string, opts: { ttlMs?: number; headers?: Record<string, string> } = {}): Promise<any> {
  return cachedRaw(url, opts, (r) => r.json());
}

/** 快取文字回應（RSS/XML 用），與 cachedFetch 共用同一個 cache Map */
export async function cachedText(url: string, opts: { ttlMs?: number; headers?: Record<string, string> } = {}): Promise<string> {
  return cachedRaw<string>(url, opts, (r) => r.text());
}
