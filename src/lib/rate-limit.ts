/**
 * Rate limiter en memoire (suffisant pour une instance Node.js unique via PM2)
 * Pour multi-instance, passer sur Redis.
 */
type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

export function checkRateLimit(key: string, maxRequests: number, windowMs: number): { allowed: boolean; remaining: number; resetIn: number } {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: maxRequests - 1, resetIn: windowMs };
  }
  if (bucket.count >= maxRequests) {
    return { allowed: false, remaining: 0, resetIn: bucket.resetAt - now };
  }
  bucket.count++;
  return { allowed: true, remaining: maxRequests - bucket.count, resetIn: bucket.resetAt - now };
}

export function cleanupRateLimit() {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt < now) buckets.delete(key);
  }
}

// Clean tous les 10 min
if (typeof setInterval !== "undefined") {
  setInterval(cleanupRateLimit, 10 * 60 * 1000).unref?.();
}

export function getClientIp(request: Request): string {
  const h = request.headers;
  return h.get("x-forwarded-for")?.split(",")[0].trim() ?? h.get("x-real-ip") ?? "unknown";
}
