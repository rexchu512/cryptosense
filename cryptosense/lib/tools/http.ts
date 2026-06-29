import "server-only";
import type { ToolResult } from "./types";

export function ok<T>(data: T, source: string): ToolResult<T> {
  return { data, source, timestamp: new Date().toISOString() };
}
export function fail<T = null>(source: string, error: string): ToolResult<T> {
  return { data: null, source, timestamp: new Date().toISOString(), error };
}

const cache = new Map<string, { at: number; value: any }>();
export function __clearCache() { cache.clear(); }

export async function cachedFetch(url: string, opts: { ttlMs?: number; headers?: Record<string, string> } = {}): Promise<any> {
  const { ttlMs = 60_000, headers } = opts;
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < ttlMs) return hit.value;
  try {
    const res = await fetch(url, { headers: { accept: "application/json", ...headers } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const value = await res.json();
    cache.set(url, { at: Date.now(), value });
    return value;
  } catch (e) {
    if (hit) return hit.value; // stale fallback
    throw e;
  }
}
