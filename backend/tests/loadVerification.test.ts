import { pool } from '../src/config/db.js';
import { orderService } from '../src/services/orderService.js';
import { closeRedisConnection } from '../src/redis/client.js';

describe('k6 Load Verification: 100 Concurrent Requests on 1 Stock Item', () => {

  afterAll(async () => {
    await closeRedisConnection();
    await pool.end();
  });

  it('should guarantee exactly 1 successful order, 99 rejected orders, and stock = 0 (0 oversold)', async () => {
    const sku = `ITEM-FLASH-${Date.now()}`;
    const initialStock = 1;
    const concurrentUsers = 100;

    // 1. Prepare Product & Inventory with Stock = 1
    await pool.query(
      `INSERT INTO products (sku, name, price) VALUES ($1, 'Flash Sale Item', 999.00)`,
      [sku]
    );

    await pool.query(
      `INSERT INTO inventory (sku, stock_quantity, version) VALUES ($1, $2, 1)`,
      [sku, initialStock]
    );

    console.log(`⚡ Initiating 100 Concurrent Orders for SKU ${sku} (Initial Stock: ${initialStock})...`);

    // 2. Launch 100 Concurrent Requests simultaneously
    const promises = Array.from({ length: concurrentUsers }).map((_, idx) =>
      orderService.createOrder({
        sku,
        quantity: 1,
        price: 999.00,
        customerEmail: `user_${idx}@example.com`,
        idempotencyKey: `idemp_load_${sku}_${idx}`,
        lockStrategy: 'PESSIMISTIC'
      }).catch((err) => ({ status: 'FAILED', error: err.message }))
    );

    const results = await Promise.all(promises);

    // Wait 300ms to allow background microtasks to finish logging
    await new Promise((res) => setTimeout(res, 300));

    // 3. Evaluate Metrics
    const completed = results.filter((r) => r.status === 'COMPLETED');
    const failed = results.filter((r) => r.status === 'FAILED' || r.status === 'CANCELLED');

    console.log(`📊 [Load Verification Summary]:`);
    console.log(`   - Successful Orders: ${completed.length}`);
    console.log(`   - Rejected Requests: ${failed.length}`);

    // 4. Query Database Stock
    const stockRes = await pool.query(`SELECT stock_quantity FROM inventory WHERE sku = $1`, [sku]);
    const finalStock = stockRes.rows[0].stock_quantity;

    console.log(`   - Final Stock Quantity: ${finalStock}`);

    // Assertions
    expect(completed.length).toBe(1);
    expect(failed.length).toBe(99);
    expect(finalStock).toBe(0); // ZERO OVERSELLING!
  }, 30000);

});
