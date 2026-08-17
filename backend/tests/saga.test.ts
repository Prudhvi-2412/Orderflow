import { sagaOrchestrator } from '../src/saga/sagaOrchestrator.js';
import { paymentService } from '../src/services/paymentService.js';
import { inventoryService } from '../src/services/inventoryService.js';
import { pool } from '../src/config/db.js';
import { closeRedisConnection } from '../src/redis/client.js';

describe('Event-Driven Saga Orchestration & Compensating Workflows', () => {

  beforeAll(async () => {
    // Seed product and inventory in database to ensure test queries succeed
    await pool.query(
      `INSERT INTO products (sku, name, price)
       VALUES ('ITEM-IPHONE-15', 'iPhone 15 Pro', 999.00)
       ON CONFLICT (sku) DO NOTHING`
    );

    await pool.query(
      `INSERT INTO inventory (sku, stock_quantity, version)
       VALUES ('ITEM-IPHONE-15', 10000, 1)
       ON CONFLICT (sku) DO UPDATE SET stock_quantity = 10000`
    );
  });

  afterAll(async () => {
    try {
      if (typeof closeRedisConnection === 'function') {
        await closeRedisConnection();
      }
    } catch (err) {}
    try {
      await pool.end();
    } catch (err) {}
  });

  beforeEach(() => {
    paymentService.setChaos(0, false);
  });

  it('should execute full Saga workflow to COMPLETED status on happy path', async () => {
    const orderId = `ORD-SAGA-OK-${Date.now()}`;
    const sku = 'ITEM-IPHONE-15';

    await pool.query(
      `INSERT INTO orders (order_id, customer_email, total_amount, status)
       VALUES ($1, 'user@orderflow.io', 999.00, 'PENDING')`,
      [orderId]
    );

    const result = await sagaOrchestrator.executeSaga(
      orderId,
      sku,
      1,
      999.00,
      'user@orderflow.io',
      'PESSIMISTIC'
    );

    expect(result.status).toBe('COMPLETED');
    expect(result.currentStep).toBe('COMPLETED');
  });

  it('should mark Saga FAILED when inventory stock is insufficient', async () => {
    const orderId = `ORD-SAGA-NOSTOCK-${Date.now()}`;
    const sku = 'ITEM-IPHONE-15';

    await pool.query(
      `INSERT INTO orders (order_id, customer_email, total_amount, status)
       VALUES ($1, 'user@orderflow.io', 999.00, 'PENDING')`,
      [orderId]
    );

    // Request 999,999 units to force inventory failure
    const result = await sagaOrchestrator.executeSaga(
      orderId,
      sku,
      999999,
      999.00,
      'user@orderflow.io',
      'PESSIMISTIC'
    );

    expect(result.status).toBe('FAILED');
    expect(result.errorReason).toContain('Insufficient stock');
  });

  it('should execute Saga Compensation (Release Stock) when payment fails', async () => {
    // Force payment gateway outage
    paymentService.setChaos(100, true);

    const orderId = `ORD-SAGA-PAYFAIL-${Date.now()}`;
    const sku = 'ITEM-IPHONE-15';

    const stockBefore =
      (await inventoryService.getStock(sku))?.stock_quantity || 5;

    await pool.query(
      `INSERT INTO orders (order_id, customer_email, total_amount, status)
       VALUES ($1, 'user@orderflow.io', 999.00, 'PENDING')`,
      [orderId]
    );

    const result = await sagaOrchestrator.executeSaga(
      orderId,
      sku,
      1,
      999.00,
      'user@orderflow.io',
      'PESSIMISTIC'
    );

    expect(result.status).toBe('CANCELLED');

    // Verify compensating transaction restored inventory quantity
    const stockAfter =
      (await inventoryService.getStock(sku))?.stock_quantity;

    expect(stockAfter).toBe(stockBefore);
  });

  it('should recover Saga state after process restart', async () => {
    const orderId = `ORD-SAGA-RESTART-${Date.now()}`;

    await pool.query(
      `INSERT INTO orders (order_id, customer_email, total_amount, status)
       VALUES ($1, 'restart@orderflow.io', 1200.00, 'INVENTORY_RESERVED')`,
      [orderId]
    );

    const recoveredSaga =
      await sagaOrchestrator.getSagaState(orderId);

    expect(recoveredSaga).not.toBeNull();
    expect(recoveredSaga?.status).toBe('INVENTORY_RESERVED');
    expect(recoveredSaga?.completedSteps).toContain(
      'INVENTORY_RESERVED'
    );
  });

});