import RedisPkg from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

const Redis = (RedisPkg as any).default || RedisPkg;
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

export const redis = new Redis(redisUrl, {
  maxRetriesPerRequest: 3,
  enableOfflineQueue: false,
  lazyConnect: true
});

let isConnected = false;

redis.on('connect', () => {
  isConnected = true;
  console.log('✅ Real Redis Client Connected.');
});

redis.on('error', (err: any) => {
  if (!isConnected) {
    console.warn(`[Redis Warning] Unable to connect to Redis at ${redisUrl} (${err.message}). Using database fallback mode.`);
  }
});

export function isRedisAvailable(): boolean {
  return isConnected;
}
