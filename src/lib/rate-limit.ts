/**
 * Fixed-window rate limit per client IP. In-memory, so on serverless it is per instance:
 * enough to stop casual abuse of a public demo URL, not a substitute for a shared store.
 */

const WINDOW_MS = 10 * 60 * 1000;

const hits = new Map<string, { count: number; resetAt: number }>();

export function takeToken(key: string, limit: number, now = Date.now()): boolean {
  const entry = hits.get(key);
  if (!entry || entry.resetAt <= now) {
    if (hits.size > 5000) hits.clear();
    hits.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (entry.count >= limit) return false;
  entry.count += 1;
  return true;
}

export function clientIp(headers: Headers): string {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip") || "unknown";
}
