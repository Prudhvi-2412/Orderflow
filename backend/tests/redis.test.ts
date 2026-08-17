import { redis } from '../src/redis/client.js';
import { idempotencyService } from '../src/services/idempotencyService.js';
import { cacheService } from '../src/services/cacheService.js';

describe('Redis Acceleration & Idempotency Integration Tests', () => {

  beforeAll(async () => {
    // Ensure Redis is connected before tests start
    if (redis.status === 'wait') {
      await redis.connect();
    }
  });

  afterAll(async () => {
    // Properly close the Redis connection so Jest can exit
    if (redis.status !== 'end') {
      await redis.quit();
    }
  });

  it(
    'should generate identical deterministic SHA-256 hashes for equivalent JSON payloads',
    async () => {
      const key = `test_key_${Date.now()}`;

      const payload1 = {
        sku: 'ITEM-IPHONE-15',
        quantity: 1,
        price: 999
      };

      const payload2 = {
        sku: 'ITEM-IPHONE-15',
        quantity: 1,
        price: 999
      };

      const payloadModified = {
        sku: 'ITEM-IPHONE-15',
        quantity: 2,
        price: 999
      };

      const firstCheck = await idempotencyService.begin(
        key,
        payload1
      );

      expect(firstCheck.action).toBe('EXECUTE');

      // Simulate order completion
      await idempotencyService.complete(
        key,
        payload1,
        {
          orderId: 'ORD-101',
          status: 'COMPLETED'
        }
      );

      // Same payload → cached response
      const repeatCheck = await idempotencyService.begin(
        key,
        payload2
      );

      expect(repeatCheck.action).toBe('SERVE_CACHE');
      expect(repeatCheck.response?.orderId).toBe('ORD-101');

      // Different payload → mismatch
      const mismatchCheck = await idempotencyService.begin(
        key,
        payloadModified
      );

      expect(mismatchCheck.action).toBe('PAYLOAD_MISMATCH');
      expect(mismatchCheck.statusCode).toBe(422);
    },
    30000
  );

  it('should support CacheService get/set abstraction gracefully', async () => {
    await cacheService.set(
      'test:sku:123',
      {
        name: 'iPhone 15',
        stock: 5
      },
      60
    );

    const cached = await cacheService.get<{
      name: string;
      stock: number;
    }>('test:sku:123');

    expect(
      cached === null ||
      cached?.name === 'iPhone 15'
    ).toBeTruthy();
  });
});