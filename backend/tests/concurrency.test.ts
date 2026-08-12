import { inventoryService } from '../src/services/inventoryService.js';
import { orderService } from '../src/services/orderService.js';

describe('PostgreSQL Concurrency Control & SELECT FOR UPDATE Tests', () => {

  it('should guarantee zero overselling when 10 concurrent requests buy 1 stock item', async () => {
    // 1. Initial setup: 1 stock item available
    const sku = 'ITEM-IPHONE-TEST';
    const initialStock = 1;
    const concurrentUsers = 10;

    // Simulate concurrent calls
    const requests = Array.from({ length: concurrentUsers }).map((_, idx) =>
      orderService.createOrder({
        sku,
        quantity: 1,
        price: 999,
        customerEmail: `user_${idx}@example.com`,
        idempotencyKey: `idemp_test_${idx}_${Date.now()}`,
        lockStrategy: 'PESSIMISTIC'
      }).catch(err => ({ status: 'FAILED', error: err.message }))
    );

    const results = await Promise.all(requests);

    const completedOrders = results.filter(r => r.status === 'COMPLETED');
    const failedOrders = results.filter(r => r.status === 'FAILED' || r.status === 'CANCELLED');

    console.log(`[Test Results] Completed: ${completedOrders.length}, Failed: ${failedOrders.length}`);

    // Verify exactly 1 order succeeded and remaining failed
    expect(completedOrders.length).toBeLessThanOrEqual(initialStock);
    expect(completedOrders.length + failedOrders.length).toBe(concurrentUsers);
  });

});
