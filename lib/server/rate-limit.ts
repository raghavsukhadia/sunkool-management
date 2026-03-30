type RateLimitResult = {
  ok: boolean
  remaining: number
  retryAfterMs: number
}

type Bucket = {
  count: number
  resetAt: number
}

const globalState = globalThis as typeof globalThis & {
  __skRateLimiter?: Map<string, Bucket>
}

const buckets = globalState.__skRateLimiter ?? new Map<string, Bucket>()
if (!globalState.__skRateLimiter) {
  globalState.__skRateLimiter = buckets
}

export function checkRateLimit(key: string, maxRequests: number, windowMs: number): RateLimitResult {
  const now = Date.now()
  const current = buckets.get(key)

  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return { ok: true, remaining: maxRequests - 1, retryAfterMs: 0 }
  }

  if (current.count >= maxRequests) {
    return {
      ok: false,
      remaining: 0,
      retryAfterMs: Math.max(0, current.resetAt - now),
    }
  }

  current.count += 1
  buckets.set(key, current)

  return {
    ok: true,
    remaining: Math.max(0, maxRequests - current.count),
    retryAfterMs: 0,
  }
}
