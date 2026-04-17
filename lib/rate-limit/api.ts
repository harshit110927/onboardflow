import { LRUCache } from "lru-cache";

// Sliding-window rate limiter for /api/v1/ routes.
// LRUCache bounds memory — evicts least-recently-seen IPs once max is reached.
// Resets on server restart — sufficient for Vercel serverless deployments.

const WINDOW_MS = 60_000; // 1 minute
const MAX_REQUESTS = 20;   // per IP per window

// Stores an array of request timestamps per IP.
// max: 10 000 unique IPs in memory at once.
const cache = new LRUCache<string, number[]>({ max: 10_000 });

export function checkApiRateLimit(ip: string): { allowed: boolean } {
  const now = Date.now();

  // Prune timestamps that have fallen outside the sliding window
  const timestamps = (cache.get(ip) ?? []).filter(
    (t) => now - t < WINDOW_MS,
  );

  if (timestamps.length >= MAX_REQUESTS) {
    cache.set(ip, timestamps); // persist pruned list so window stays accurate
    return { allowed: false };
  }

  timestamps.push(now);
  cache.set(ip, timestamps);
  return { allowed: true };
}