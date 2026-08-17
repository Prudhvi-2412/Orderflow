import RedisPkg from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

const Redis = (RedisPkg as any).default || RedisPkg;
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

export const redis = new Redis(redisUrl, {
  maxRetriesPerRequest: 3,
  enableOfflineQueue: false,
  enableReadyCheck: false,
  lazyConnect: true
});

let isConnected = false;

redis.on('connect', () => {
  isConnected = true;
  console.log('✅ Real Redis Client Connected.');
});

redis.on('error', (err: any) => {
  if (!isConnected) {
    console.warn(
      `[Redis Warning] Unable to connect to Redis at ${redisUrl} (${err.message}). Using database fallback mode.`
    );
  }
});

redis.on('close', () => {
  isConnected = false;
});

export function isRedisAvailable(): boolean {
  return isConnected;
}

export async function closeRedisConnection(): Promise<void> {
  if (redis.status !== 'end') {
    try {
      await redis.quit();
    } catch (e) {
      redis.disconnect();
    }
  }
}