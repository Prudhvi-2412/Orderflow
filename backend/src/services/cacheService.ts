import { redis } from '../redis/client.js';

export class RedisCacheService {
  private defaultTTL = 300; // 5 minutes

  async get<T>(key: string): Promise<T | null> {
    try {
      const data = await redis.get(key);
      return data ? JSON.parse(data) : null;
    } catch (err) {
      return null;
    }
  }

  async set(key: string, value: any, ttlSeconds = this.defaultTTL): Promise<void> {
    try {
      await redis.setex(key, ttlSeconds, JSON.stringify(value));
    } catch (err) {}
  }

  async del(key: string): Promise<void> {
    try {
      await redis.del(key);
    } catch (err) {}
  }
}

export const cacheService = new RedisCacheService();
