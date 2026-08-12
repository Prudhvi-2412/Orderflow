import { idempotencyService } from '../src/services/idempotencyService.js';
import { pool } from '../src/config/db.js';

describe('HTTP Idempotency Key & Concurrent Ownership Tests', () => {

  it('should allow first request execution and serve cached response on duplicate request', async () => {
    const key = `test_key_first_${Date.now()}`;
    const payload = { sku: 'ITEM-IPHONE-15', quantity: 1, customerEmail: 'test@orderflow.io' };

    // 1. First Request
    const res1 = await idempotencyService.begin(key, payload);
    expect(res1.action).toBe('EXECUTE');

    // Complete processing
    const responseBody = { orderId: 'ORD-1001', status: 'COMPLETED' };
    await idempotencyService.complete(key, payload, responseBody);

    // 2. Duplicate Sequential Request with SAME payload
    const res2 = await idempotencyService.begin(key, payload);
    expect(res2.action).toBe('SERVE_CACHE');
    expect(res2.response).toEqual(responseBody);
  });

  it('should return 422 PAYLOAD_MISMATCH when same key is used with a different request body', async () => {
    const key = `test_key_mismatch_${Date.now()}`;
    const payloadA = { sku: 'ITEM-IPHONE-15', quantity: 1 };
    const payloadB = { sku: 'ITEM-MACBOOK-PRO', quantity: 5 }; // Different payload!

    // Request A begins
    const resA = await idempotencyService.begin(key, payloadA);
    expect(resA.action).toBe('EXECUTE');
    await idempotencyService.complete(key, payloadA, { orderId: 'ORD-A' });

    // Request B sends SAME key but DIFFERENT payload
    const resB = await idempotencyService.begin(key, payloadB);
    expect(resB.action).toBe('PAYLOAD_MISMATCH');
    expect(resB.statusCode).toBe(422);
  });

  it('should handle concurrent requests safely without duplicate execution', async () => {
    const key = `test_key_concurrent_${Date.now()}`;
    const payload = { sku: 'ITEM-FLASH-SALE', quantity: 1 };

    // Fire 2 parallel requests with same key & body
    const [resA, resB] = await Promise.all([
      idempotencyService.begin(key, payload),
      idempotencyService.begin(key, payload)
    ]);

    // Exactly one request must get 'EXECUTE'
    const actions = [resA.action, resB.action];
    expect(actions).toContain('EXECUTE');
    expect(actions.filter(a => a === 'EXECUTE').length).toBe(1);

    // The other request must be rejected as IN_PROGRESS (409) or SERVE_CACHE
    const otherAction = actions.find(a => a !== 'EXECUTE');
    expect(['IN_PROGRESS', 'SERVE_CACHE']).toContain(otherAction);
  });

  it('should allow retry after a failed request', async () => {
    const key = `test_key_retry_${Date.now()}`;
    const payload = { sku: 'ITEM-FAIL-RETRY', quantity: 1 };

    // 1. Initial attempt fails
    const res1 = await idempotencyService.begin(key, payload);
    expect(res1.action).toBe('EXECUTE');
    await idempotencyService.fail(key);

    // 2. Retry attempt should be allowed
    const res2 = await idempotencyService.begin(key, payload);
    expect(res2.action).toBe('EXECUTE');
  });

});
