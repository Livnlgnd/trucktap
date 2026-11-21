import type { NextFunction, Request, Response } from 'express'

interface Bucket {
  count: number
  resetAt: number
}

const buckets = new Map<string, Bucket>()

export function authRateLimit(
  request: Request,
  response: Response,
  next: NextFunction,
): void {
  const now = Date.now()
  const key = request.ip ?? request.socket.remoteAddress ?? 'unknown'
  const existing = buckets.get(key)

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + 10 * 60_000 })
    next()
    return
  }

  if (existing.count >= 40) {
    response
      .status(429)
      .json({ error: 'Too many sign-in attempts. Wait a few minutes and try again.' })
    return
  }

  existing.count += 1
  next()
}
