// Minimal in-process fixed-window rate limiter. On serverless this only
// bounds bursts within one warm instance — production-grade limiting
// (Upstash / Vercel WAF) is tracked in docs/launch-plan.md M1. It exists to
// stop naive request loops, not determined attackers.

type Window = { resetAt: number; count: number };

const windows = new Map<string, Window>();
const MAX_TRACKED_KEYS = 10_000;

function prune(now: number): void {
  for (const [key, w] of windows) {
    if (w.resetAt <= now) windows.delete(key);
  }
}

/** Returns true when the call is allowed within `limit` per `windowMs`. */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  if (windows.size > MAX_TRACKED_KEYS) prune(now);
  const w = windows.get(key);
  if (!w || w.resetAt <= now) {
    windows.set(key, { resetAt: now + windowMs, count: 1 });
    return true;
  }
  w.count += 1;
  return w.count <= limit;
}

/** Best-effort client key: first hop of x-forwarded-for, else a shared bucket. */
export function clientKey(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "unknown";
}
