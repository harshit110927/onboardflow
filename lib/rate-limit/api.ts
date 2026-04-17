import { LRUCache } from "lru-cache";

const WINDOW_MS = 60_000; // 1 minute sliding window
const MAX_REQUESTS = 20;  // requests per window per IP

// Keeps at most 10 000 distinct IPs in memory at once.
// Each value is an array of timestamps within the current window.
const cache = new LRUCache<string, number[]>({ max: 10_000 });

export function checkApiRateLimit(ip: string): { allowed: boolean } {
  const now = Date.now();

  // Drop timestamps that have fallen outside the window
  const timestamps = (cache.get(ip) ?? []).filter(
    (t) => now - t < WINDOW_MS,
  );

  if (timestamps.length >= MAX_REQUESTS) {
    cache.set(ip, timestamps); // persist the pruned list
    return { allowed: false };
  }

  timestamps.push(now);
  cache.set(ip, timestamps);
  return { allowed: true };
}