// Simple in-memory rate limiter for /api/v1/ routes
// Resets on server restart — sufficient for Vercel serverless with reasonable limits

const requestCounts = new Map<string, { count: number; resetAt: number }>();

const WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS = 60;

export function checkApiRateLimit(ip: string): { allowed: boolean } {
  const now = Date.now();
  const existing = requestCounts.get(ip);

  if (!existing || now > existing.resetAt) {
    requestCounts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true };
  }

  if (existing.count >= MAX_REQUESTS) {
    return { allowed: false };
  }

  existing.count++;
  return { allowed: true };
}