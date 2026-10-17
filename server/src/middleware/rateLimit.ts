import type { Request, Response, NextFunction } from "express";

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

export interface RateLimitOptions {
  windowMs?: number;
  maxRequests?: number;
  message?: string;
}

export function createAuthRateLimiter(options: RateLimitOptions = {}) {
  const windowMs = options.windowMs || 15 * 60 * 1000; // 15 minutes
  const maxRequests = options.maxRequests || 100; // 100 requests per 15 min
  const message =
    options.message || "Too many authentication attempts, please try again later";

  const hits = new Map<string, RateLimitRecord>();

  // Periodic cleanup of expired records every 5 minutes
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [ip, record] of hits.entries()) {
      if (now > record.resetTime) {
        hits.delete(ip);
      }
    }
  }, 5 * 60 * 1000);
  timer.unref();

  return (req: Request, res: Response, next: NextFunction): void => {
    // In test environment, bypass rate limiter unless explicitly testing it
    if (process.env.NODE_ENV === "test" && !process.env.TEST_RATE_LIMIT) {
      return next();
    }

    const ip = req.ip || req.socket.remoteAddress || "unknown";
    const now = Date.now();
    let record = hits.get(ip);

    if (!record || now > record.resetTime) {
      record = { count: 1, resetTime: now + windowMs };
      hits.set(ip, record);
    } else {
      record.count += 1;
    }

    const remaining = Math.max(0, maxRequests - record.count);
    const resetSeconds = Math.ceil((record.resetTime - now) / 1000);

    res.setHeader("RateLimit-Limit", maxRequests);
    res.setHeader("RateLimit-Remaining", remaining);
    res.setHeader("RateLimit-Reset", resetSeconds);

    if (record.count > maxRequests) {
      res.setHeader("Retry-After", resetSeconds);
      res.status(429).json({ message });
      return;
    }

    next();
  };
}
