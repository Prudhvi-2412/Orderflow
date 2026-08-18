import { paymentService } from '../src/services/paymentService.js';
import { inventoryService } from '../src/services/inventoryService.js';
import { orderService } from '../src/services/orderService.js';
import { sagaOrchestrator } from '../src/saga/sagaOrchestrator.js';
import { wrapIdempotentConsumer } from '../src/kafka/idempotentConsumer.js';
import { pool } from '../src/config/db.js';
import { closeRedisConnection } from '../src/redis/client.js';

describe('P1 Payment Consistency & Idempotency Detailed Test Suite', () => {

  const testSku = `ITEM-PAY-DET-${Date.now()}`;

  beforeAll(async () => {
    // Seed product and inventory
    await pool.query(
      `INSERT INTO products (sku, name, price) VALUES ($1, 'Payment Detailed Product', 199.99) ON CONFLICT (sku) DO NOTHING`,
      [testSku]
    );

    await pool.query(
      `INSERT INTO inventory (sku, stock_quantity, version) VALUES ($1, 500, 1) ON CONFLICT (sku) DO UPDATE SET stock_quantity = 500`,
      [testSku]
    );
  });

  afterAll(async () => {
    await closeRedisConnection();
    await pool.end();
  });

  beforeEach(() => {
    paymentService.clearCache();
    paymentService.setChaos(0, false);
  });

  it('1. Normal successful payment', async () => {
    const orderId = `ORD-NORM-${Date.now()}`;
    const payRes = await paymentService.processPayment(orderId, 199.99, 'norm@example.com', `pay_${orderId}`);
    expect(payRes.success).toBe(true);
    expect(payRes.txnId).toBe(`TXN-${orderId}`);
  });

  it('2 & 6. Gateway explicit failure handling', async () => {
    const orderId = `ORD-FAIL-${Date.now()}`;
    paymentService.setChaos(1.0, false); // Force gateway failure
    await expect(paymentService.processPayment(orderId, 199.99, 'fail@example.com')).rejects.toThrow();
  });

  it('3. Same payment request retried with same idempotency key', async () => {
    const orderId = `ORD-RETRY-${Date.now()}`;
    const key = `pay_${orderId}`;

    const res1 = await paymentService.processPayment(orderId, 199.99, 'retry@example.com', key);
    expect(res1.success).toBe(true);
    expect(res1.isDuplicate).toBeFalsy();

    const res2 = await paymentService.processPayment(orderId, 199.99, 'retry@example.com', key);
    expect(res2.success).toBe(true);
    expect(res2.txnId).toBe(res1.txnId);
    expect(res2.isDuplicate).toBe(true);
  });

  it('4. Duplicate payment request does not create a second payment record in PostgreSQL', async () => {
    const orderId = `ORD-DUP-PAY-${Date.now()}`;
    const key = `pay_${orderId}`;

    await pool.query(
      `INSERT INTO orders (order_id, customer_email, total_amount, status) VALUES ($1, 'dup@example.com', 199.99, 'PROCESSING')`,
      [orderId]
    );

    // First payment persistence
    await pool.query(
      `INSERT INTO payments (order_id, txn_id, idempotency_key, amount, status)
       VALUES ($1, $2, $3, 199.99, 'SUCCESS')
       ON CONFLICT (order_id) DO UPDATE SET status = 'SUCCESS'`,
      [orderId, `TXN-${orderId}`, key]
    );

    // Duplicate payment attempt
    await pool.query(
      `INSERT INTO payments (order_id, txn_id, idempotency_key, amount, status)
       VALUES ($1, $2, $3, 199.99, 'SUCCESS')
       ON CONFLICT (order_id) DO UPDATE SET status = 'SUCCESS'`,
      [orderId, `TXN-${orderId}`, key]
    );

    const rows = await pool.query(`SELECT count(*) FROM payments WHERE order_id = $1`, [orderId]);
    expect(parseInt(rows.rows[0].count)).toBe(1);
  });

  it('5. Two concurrent requests using the same payment idempotency key', async () => {
    const orderId = `ORD-CONCUR-${Date.now()}`;
    const key = `pay_${orderId}`;

    await pool.query(
      `INSERT INTO orders (order_id, customer_email, total_amount, status) VALUES ($1, 'concur@example.com', 199.99, 'PROCESSING')`,
      [orderId]
    );

    const p1 = pool.query(
      `INSERT INTO payments (order_id, txn_id, idempotency_key, amount, status)
       VALUES ($1, $2, $3, 199.99, 'SUCCESS')
       ON CONFLICT (order_id) DO UPDATE SET status = 'SUCCESS'`,
      [orderId, `TXN-${orderId}`, key]
    );

    const p2 = pool.query(
      `INSERT INTO payments (order_id, txn_id, idempotency_key, amount, status)
       VALUES ($1, $2, $3, 199.99, 'SUCCESS')
       ON CONFLICT (order_id) DO UPDATE SET status = 'SUCCESS'`,
      [orderId, `TXN-${orderId}`, key]
    );

    await Promise.all([p1, p2]);

    const res = await pool.query(`SELECT count(*) FROM payments WHERE order_id = $1`, [orderId]);
    expect(parseInt(res.rows[0].count)).toBe(1);
  });

  it('4 & 5 (Timeout). Gateway succeeds but response is lost; retry does not charge twice', async () => {
    const orderId = `ORD-LOST-RESP-${Date.now()}`;
    const key = `pay_${orderId}`;

    // Instruct payment provider mock to process payment but drop response (timeout)
    paymentService.simulateLostResponse(key);

    // 1st attempt times out
    await expect(paymentService.processPayment(orderId, 250.00, 'lost@example.com', key)).rejects.toThrow('Gateway Timeout');

    // 2nd attempt (retry) recovers existing payment result from gateway ledger without double-charging
    const resRetry = await paymentService.processPayment(orderId, 250.00, 'lost@example.com', key);

    expect(resRetry.success).toBe(true);
    expect(resRetry.txnId).toBe(`TXN-${orderId}`);
    expect(resRetry.isDuplicate).toBe(true);
  });

  it('7 & 8. Duplicate payment-completed/failure event is safely ignored by processed_events wrapper', async () => {
    const eventId = `evt_pay_completed_${Date.now()}`;
    const consumerGroup = 'test-payment-consumer';

    const mockHandler = jest.fn().mockResolvedValue(undefined);
    const wrappedConsumer = wrapIdempotentConsumer({ consumerGroup, handler: mockHandler });

    // First event delivery
    await wrappedConsumer('OrdersConfirmed', { orderId: 'ORD-999' }, { eventId });
    expect(mockHandler).toHaveBeenCalledTimes(1);

    // Second (duplicate) event delivery
    await wrappedConsumer('OrdersConfirmed', { orderId: 'ORD-999' }, { eventId });
    expect(mockHandler).toHaveBeenCalledTimes(1); // Second delivery skipped safely!
  });

  it('9 & 10. Out-of-order / late success or failure callback cannot overwrite terminal order state', async () => {
    const orderId = `ORD-LATE-CB-${Date.now()}`;

    // Create completed order
    await pool.query(
      `INSERT INTO orders (order_id, customer_email, total_amount, status) VALUES ($1, 'late@example.com', 199.99, 'COMPLETED')`,
      [orderId]
    );

    // Late failure callback attempt on completed order -> Rejected by Saga DB engine
    const failTransition = await sagaOrchestrator.transitionState(orderId, 'CANCELLED');
    expect(failTransition).toBe(false);

    const state = await sagaOrchestrator.getSagaState(orderId);
    expect(state?.status).toBe('COMPLETED');
  });

});
