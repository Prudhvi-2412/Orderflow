import { Request, Response, NextFunction } from 'express';
import { redis } from '../redis/client.js';

interface RateLimiterOptions {
  windowSeconds?: number;
  maxRequests?: number;
}

export function createRedisRateLimiter(options: RateLimiterOptions = {}) {
  const windowSeconds = options.windowSeconds || 60; // 1 minute window
  const maxRequests = options.maxRequests || 30;     // 30 requests per minute limit

  return async (req: Request, res: Response, next: NextFunction) => {
    const clientIp = req.ip || req.socket.remoteAddress || '127.0.0.1';
    const redisKey = `ratelimit:${clientIp}`;

    try {
      const requests = await redis.incr(redisKey);

      if (requests === 1) {
        await redis.expire(redisKey, windowSeconds);
      }

      res.setHeader('X-RateLimit-Limit', maxRequests);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - requests));

      if (requests > maxRequests) {
        return res.status(429).json({
          error: 'HTTP 429 Too Many Requests',
          message: `Rate limit of ${maxRequests} requests per ${windowSeconds}s exceeded. Try again later.`
        });
      }

      next();
    } catch (err) {
      // If Redis fails, allow request through (fail open for availability)
      next();
    }
  };
}
