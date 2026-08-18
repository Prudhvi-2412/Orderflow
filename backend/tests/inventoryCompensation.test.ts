import { inventoryService } from '../src/services/inventoryService.js';
import { sagaOrchestrator } from '../src/saga/sagaOrchestrator.js';
import { pool } from '../src/config/db.js';
import { closeRedisConnection } from '../src/redis/client.js';

describe('Idempotent Inventory Concurrency & Compensation Test Suite', () => {

  const sku = `ITEM-COMP-${Date.now()}`;
  const initialStock = 50;

  beforeAll(async () => {
    // Seed product and inventory
    await pool.query(
      `INSERT INTO products (sku, name, price) VALUES ($1, 'Compensation Product', 49.99) ON CONFLICT (sku) DO NOTHING`,
      [sku]
    );

    await pool.query(
      `INSERT INTO inventory (sku, stock_quantity, version) VALUES ($1, $2, 1) ON CONFLICT (sku) DO UPDATE SET stock_quantity = $2`,
      [sku, initialStock]
    );
  });

  afterAll(async () => {
    await closeRedisConnection();
    await pool.end();
  });

  it('1. Stock = 1, two concurrent orders -> exactly 1 succeeds, remaining stock = 0', async () => {
    const concSku = `SKU-CONC-1-${Date.now()}`;
    await pool.query(
      `INSERT INTO products (sku, name, price) VALUES ($1, 'Conc Product 1', 10.00) ON CONFLICT DO NOTHING`,
      [concSku]
    );
    await pool.query(
      `INSERT INTO inventory (sku, stock_quantity, version) VALUES ($1, 1, 1) ON CONFLICT (sku) DO UPDATE SET stock_quantity = 1`,
      [concSku]
    );

    const orderIdA = `ORD-CONC1-A-${Date.now()}`;
    const orderIdB = `ORD-CONC1-B-${Date.now()}`;

    const [resA, resB] = await Promise.all([
      inventoryService.reserveStock(null, concSku, 1, 'PESSIMISTIC', orderIdA),
      inventoryService.reserveStock(null, concSku, 1, 'PESSIMISTIC', orderIdB)
    ]);

    const results = [resA, resB];
    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    expect(successCount).toBe(1);
    expect(failCount).toBe(1);

    const stock = await inventoryService.getStock(concSku);
    expect(stock.stock_quantity).toBe(0);
  });

  it('2. Stock = 10, ten concurrent quantity-1 orders -> all 10 succeed, stock = 0', async () => {
    const concSku = `SKU-CONC-10-${Date.now()}`;
    await pool.query(
      `INSERT INTO products (sku, name, price) VALUES ($1, 'Conc Product 10', 10.00) ON CONFLICT DO NOTHING`,
      [concSku]
    );
    await pool.query(
      `INSERT INTO inventory (sku, stock_quantity, version) VALUES ($1, 10, 1) ON CONFLICT (sku) DO UPDATE SET stock_quantity = 10`,
      [concSku]
    );

    const promises = Array.from({ length: 10 }).map((_, i) =>
      inventoryService.reserveStock(null, concSku, 1, 'PESSIMISTIC', `ORD-10-${i}-${Date.now()}`)
    );

    const results = await Promise.all(promises);
    expect(results.every(r => r.success)).toBe(true);

    const stock = await inventoryService.getStock(concSku);
    expect(stock.stock_quantity).toBe(0);
  });

  it('3. Stock = 10, eleven concurrent quantity-1 orders -> exactly 10 succeed, 1 fails', async () => {
    const concSku = `SKU-CONC-11-${Date.now()}`;
    await pool.query(
      `INSERT INTO products (sku, name, price) VALUES ($1, 'Conc Product 11', 10.00) ON CONFLICT DO NOTHING`,
      [concSku]
    );
    await pool.query(
      `INSERT INTO inventory (sku, stock_quantity, version) VALUES ($1, 10, 1) ON CONFLICT (sku) DO UPDATE SET stock_quantity = 10`,
      [concSku]
    );

    const promises = Array.from({ length: 11 }).map((_, i) =>
      inventoryService.reserveStock(null, concSku, 1, 'PESSIMISTIC', `ORD-11-${i}-${Date.now()}`)
    );

    const results = await Promise.all(promises);
    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    expect(successCount).toBe(10);
    expect(failCount).toBe(1);

    const stock = await inventoryService.getStock(concSku);
    expect(stock.stock_quantity).toBe(0);
  });

  it('4. Stock = 10, concurrent quantity-5 requests (3 requests) -> only 2 succeed', async () => {
    const concSku = `SKU-CONC-Q5-${Date.now()}`;
    await pool.query(
      `INSERT INTO products (sku, name, price) VALUES ($1, 'Conc Product Q5', 10.00) ON CONFLICT DO NOTHING`,
      [concSku]
    );
    await pool.query(
      `INSERT INTO inventory (sku, stock_quantity, version) VALUES ($1, 10, 1) ON CONFLICT (sku) DO UPDATE SET stock_quantity = 10`,
      [concSku]
    );

    const promises = [1, 2, 3].map(i =>
      inventoryService.reserveStock(null, concSku, 5, 'PESSIMISTIC', `ORD-Q5-${i}-${Date.now()}`)
    );

    const results = await Promise.all(promises);
    const successCount = results.filter(r => r.success).length;
    expect(successCount).toBe(2);

    const stock = await inventoryService.getStock(concSku);
    expect(stock.stock_quantity).toBe(0);
  });

  it('5 & 6. Duplicate reservation for same order does not double-deduct stock', async () => {
    const orderId = `ORD-DUP-RES-${Date.now()}`;
    const res1 = await inventoryService.reserveStock(null, sku, 2, 'PESSIMISTIC', orderId);
    expect(res1.success).toBe(true);

    const stockAfter1 = (await inventoryService.getStock(sku)).stock_quantity;

    // Retry reservation for same order
    const res2 = await inventoryService.reserveStock(null, sku, 2, 'PESSIMISTIC', orderId);
    expect(res2.success).toBe(true);
    expect(res2.isDuplicate).toBe(true);

    const stockAfter2 = (await inventoryService.getStock(sku)).stock_quantity;
    expect(stockAfter2).toBe(stockAfter1); // Stock unchanged!
  });

  it('8 & 9. Quantity 0 or negative is rejected fast', async () => {
    const res0 = await inventoryService.reserveStock(null, sku, 0, 'PESSIMISTIC', 'ORD-Q0');
    expect(res0.success).toBe(false);
    expect(res0.error).toContain('greater than 0');

    const resNeg = await inventoryService.reserveStock(null, sku, -5, 'PESSIMISTIC', 'ORD-QNEG');
    expect(resNeg.success).toBe(false);
    expect(resNeg.error).toContain('greater than 0');
  });

  it('10 & 11. Releasing reservation twice restores stock ONLY ONCE', async () => {
    const orderId = `ORD-REL-TWICE-${Date.now()}`;
    await inventoryService.reserveStock(null, sku, 4, 'PESSIMISTIC', orderId);

    const stockBefore = (await inventoryService.getStock(sku)).stock_quantity;

    const rel1 = await inventoryService.releaseStock(sku, 4, orderId);
    expect(rel1.released).toBe(true);

    const stockAfterFirst = (await inventoryService.getStock(sku)).stock_quantity;
    expect(stockAfterFirst).toBe(stockBefore + 4);

    // Second release attempt
    const rel2 = await inventoryService.releaseStock(sku, 4, orderId);
    expect(rel2.released).toBe(false);

    const stockAfterSecond = (await inventoryService.getStock(sku)).stock_quantity;
    expect(stockAfterSecond).toBe(stockAfterFirst);
  });

  it('13. Concurrent release requests for same reservation restore stock ONLY ONCE', async () => {
    const orderId = `ORD-REL-CONCUR-${Date.now()}`;
    await inventoryService.reserveStock(null, sku, 6, 'PESSIMISTIC', orderId);

    const stockBefore = (await inventoryService.getStock(sku)).stock_quantity;

    const [r1, r2] = await Promise.all([
      inventoryService.releaseStock(sku, 6, orderId),
      inventoryService.releaseStock(sku, 6, orderId)
    ]);

    const releasedCount = [r1, r2].filter(r => r.released).length;
    expect(releasedCount).toBe(1);

    const stockAfter = (await inventoryService.getStock(sku)).stock_quantity;
    expect(stockAfter).toBe(stockBefore + 6);
  });

  it('14. Payment failure Saga triggers idempotent stock release', async () => {
    const orderId = `ORD-SAGA-COMP-${Date.now()}`;

    await pool.query(
      `INSERT INTO orders (order_id, customer_email, total_amount, status) VALUES ($1, 'saga.fail@example.com', 49.99, 'PROCESSING')`,
      [orderId]
    );
    await inventoryService.reserveStock(null, sku, 3, 'PESSIMISTIC', orderId);

    const stockBefore = (await inventoryService.getStock(sku)).stock_quantity;

    await sagaOrchestrator.handlePaymentFailed({
      orderId,
      sku,
      quantity: 3,
      error: 'Simulated payment failure'
    });

    const stockAfter = (await inventoryService.getStock(sku)).stock_quantity;
    expect(stockAfter).toBe(stockBefore + 3);
  });

  it('15. P0-2 Regression: Reserve -> Release -> Retry Reserve rejects re-reservation & does NOT deduct stock', async () => {
    const orderId = `ORD-RELEASED-RETRY-${Date.now()}`;
    
    // 1. Initial reservation
    const res1 = await inventoryService.reserveStock(null, sku, 2, 'PESSIMISTIC', orderId);
    expect(res1.success).toBe(true);

    // 2. Release reservation (RESERVED -> RELEASED)
    const rel = await inventoryService.releaseStock(sku, 2, orderId);
    expect(rel.released).toBe(true);

    const stockAfterRelease = (await inventoryService.getStock(sku)).stock_quantity;

    // 3. Retry reserve for same orderId
    const resRetry = await inventoryService.reserveStock(null, sku, 2, 'PESSIMISTIC', orderId);
    expect(resRetry.success).toBe(false);
    expect(resRetry.error).toContain('RELEASED and cannot be re-reserved');

    // 4. Verify stock quantity is unchanged
    const stockAfterRetry = (await inventoryService.getStock(sku)).stock_quantity;
    expect(stockAfterRetry).toBe(stockAfterRelease);

    // 5. Verify reservation status remains RELEASED in database
    const dbCheck = await pool.query(`SELECT status FROM inventory_reservations WHERE order_id = $1`, [orderId]);
    expect(dbCheck.rows[0].status).toBe('RELEASED');
  });

  it('16. P1-2: Optimistic reservation mutation and reservation creation are atomic inside transaction', async () => {
    const optOrder = `ORD-OPT-ATOMIC-${Date.now()}`;
    const optRes = await inventoryService.reserveStock(null, sku, 1, 'OPTIMISTIC', optOrder);
    expect(optRes.success).toBe(true);

    const dbCheck = await pool.query(`SELECT status FROM inventory_reservations WHERE order_id = $1`, [optOrder]);
    expect(dbCheck.rows[0].status).toBe('RESERVED');
  });

});
