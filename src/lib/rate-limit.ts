// Minimal in-memory sliding-window rate limiter.
// Good enough for a single-instance deployment; swap for Upstash/Redis if scaling out.
const hits = new Map<string, number[]>();

const WINDOW_MS = 60_000;

export function rateLimit(key: string, limit: number): { ok: boolean; retryAfterMs?: number } {
  const now = Date.now();
  const windowStart = now - WINDOW_MS;
  const timestamps = (hits.get(key) ?? []).filter((t) => t > windowStart);

  if (timestamps.length >= limit) {
    const retryAfterMs = timestamps[0] + WINDOW_MS - now;
    hits.set(key, timestamps);
    return { ok: false, retryAfterMs };
  }

  timestamps.push(now);
  hits.set(key, timestamps);
  return { ok: true };
}

// Periodic cleanup so the map doesn't grow unbounded on a long-lived server.
setInterval(() => {
  const windowStart = Date.now() - WINDOW_MS;
  for (const [key, timestamps] of hits) {
    const fresh = timestamps.filter((t) => t > windowStart);
    if (fresh.length === 0) hits.delete(key);
    else hits.set(key, fresh);
  }
}, WINDOW_MS).unref?.();
