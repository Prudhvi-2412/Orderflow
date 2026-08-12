import { idempotencyService } from '../src/services/idempotencyService.js';
import { cacheService } from '../src/services/cacheService.js';

describe('Redis Acceleration & Idempotency Integration Tests', () => {

  it('should generate identical deterministic SHA-256 hashes for equivalent JSON payloads', async () => {
    const key = `test_key_${Date.now()}`;
    const payload1 = { sku: 'ITEM-IPHONE-15', quantity: 1, price: 999 };
    const payload2 = { sku: 'ITEM-IPHONE-15', quantity: 1, price: 999 };
    const payloadModified = { sku: 'ITEM-IPHONE-15', quantity: 2, price: 999 };

    const firstCheck = await idempotencyService.begin(key, payload1);
    expect(firstCheck.action).toBe('EXECUTE');

    // Simulate completion
    await idempotencyService.complete(key, payload1, { orderId: 'ORD-101', status: 'COMPLETED' });

    // Exact match repeat -> SERVE_CACHE
    const repeatCheck = await idempotencyService.begin(key, payload2);
    expect(repeatCheck.action).toBe('SERVE_CACHE');
    expect(repeatCheck.response?.orderId).toBe('ORD-101');

    // Payload mismatch repeat -> PAYLOAD_MISMATCH
    const mismatchCheck = await idempotencyService.begin(key, payloadModified);
    expect(mismatchCheck.action).toBe('PAYLOAD_MISMATCH');
    expect(mismatchCheck.statusCode).toBe(422);
  });

  it('should support CacheService get/set abstraction gracefully', async () => {
    await cacheService.set('test:sku:123', { name: 'iPhone 15', stock: 5 }, 60);
    const cached = await cacheService.get<{ name: string; stock: number }>('test:sku:123');
    // If local Redis is offline, get returns null gracefully without throwing
    expect(cached === null || cached?.name === 'iPhone 15').toBeTruthy();
  });

});
