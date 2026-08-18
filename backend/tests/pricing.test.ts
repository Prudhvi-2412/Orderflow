import request from 'supertest';
import app from '../src/server.js';
import { pool } from '../src/config/db.js';
import { closeRedisConnection } from '../src/redis/client.js';

describe('Pricing Security & Authoritative DB Pricing Tests', () => {

  const testSku = `ITEM-PRICING-TEST-${Date.now()}`;
  const dbUnitPrice = 499.99;

  beforeAll(async () => {
    // Seed product with DB price 499.99
    await pool.query(
      `INSERT INTO products (sku, name, price) VALUES ($1, 'Security Test Phone', $2) ON CONFLICT (sku) DO NOTHING`,
      [testSku, dbUnitPrice]
    );

    // Seed inventory stock = 100
    await pool.query(
      `INSERT INTO inventory (sku, stock_quantity, version) VALUES ($1, 100, 1) ON CONFLICT (sku) DO UPDATE SET stock_quantity = 100`,
      [testSku]
    );
  });

  afterAll(async () => {
    await closeRedisConnection();
    await pool.end();
  });

  it('a. Valid SKU uses the database price and ignores client price', async () => {
    const res = await request(app)
      .post('/api/orders')
      .send({
        sku: testSku,
        quantity: 1,
        price: 1.00, // Client attempts to buy $499.99 item for $1.00!
        customerEmail: 'attacker@example.com',
        idempotencyKey: `idemp_price_test_a_${Date.now()}`
      });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('COMPLETED');
    expect(res.body.unitPrice).toBe(499.99);
    expect(res.body.totalAmount).toBe(499.99);

    // Verify stored price in order_items table is 499.99 (NOT 1.00)
    const itemRes = await pool.query(
      `SELECT price FROM order_items WHERE order_id = $1`,
      [res.body.orderId]
    );
    expect(parseFloat(itemRes.rows[0].price)).toBe(499.99);
  });

  it('b. Client attempts to send a different price and the backend ignores it', async () => {
    const res = await request(app)
      .post('/api/orders')
      .send({
        sku: testSku,
        quantity: 2,
        price: 0.01, // Client attempts $0.01
        customerEmail: 'hacker@example.com',
        idempotencyKey: `idemp_price_test_b_${Date.now()}`
      });

    expect(res.status).toBe(201);
    expect(res.body.totalAmount).toBe(999.98); // 499.99 * 2 = 999.98

    // Query database orders table directly
    const orderRes = await pool.query(
      `SELECT total_amount FROM orders WHERE order_id = $1`,
      [res.body.orderId]
    );
    expect(parseFloat(orderRes.rows[0].total_amount)).toBe(999.98);
  });

  it('c. Unknown SKU is rejected with HTTP 404', async () => {
    const res = await request(app)
      .post('/api/orders')
      .send({
        sku: 'ITEM-NONEXISTENT-99999',
        quantity: 1,
        customerEmail: 'user@example.com',
        idempotencyKey: `idemp_unknown_sku_${Date.now()}`
      });

    expect(res.status).toBe(404);
    expect(res.body.error).toContain('Product not found for SKU: ITEM-NONEXISTENT-99999');
  });

  it('d. Correct total amount is stored and calculated for multi-quantity order', async () => {
    const qty = 3;
    const expectedTotal = dbUnitPrice * qty; // 499.99 * 3 = 1499.97

    const res = await request(app)
      .post('/api/orders')
      .send({
        sku: testSku,
        quantity: qty,
        customerEmail: 'multi@example.com',
        idempotencyKey: `idemp_multi_qty_${Date.now()}`
      });

    expect(res.status).toBe(201);
    expect(res.body.totalAmount).toBe(expectedTotal);
  });

  it('e. Payment receives the server-calculated amount in payments table', async () => {
    const res = await request(app)
      .post('/api/orders')
      .send({
        sku: testSku,
        quantity: 1,
        price: 5.00, // Malicious client price
        customerEmail: 'paytest@example.com',
        idempotencyKey: `idemp_pay_amount_${Date.now()}`
      });

    expect(res.status).toBe(201);

    // Verify payment record in payments table
    const payRes = await pool.query(
      `SELECT amount FROM payments WHERE order_id = $1`,
      [res.body.orderId]
    );
    expect(parseFloat(payRes.rows[0].amount)).toBe(499.99); // Server calculated amount!
  });

  it('f. Existing successful order flow still works end-to-end', async () => {
    const res = await request(app)
      .post('/api/orders')
      .send({
        sku: testSku,
        quantity: 1,
        customerEmail: 'happy@example.com'
      });

    expect(res.status).toBe(201);
    expect(res.body.orderId).toBeDefined();
    expect(res.body.status).toBe('COMPLETED');
  });

});
