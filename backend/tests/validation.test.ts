import request from 'supertest';
import app from '../src/server.js';
import { pool } from '../src/config/db.js';
import { closeRedisConnection } from '../src/redis/client.js';

describe('Strict API Input Validation Test Suite for Orders', () => {

  const validSku = `ITEM-VAL-TEST-${Date.now()}`;
  const initialStock = 50;

  beforeAll(async () => {
    // Seed test product and inventory
    await pool.query(
      `INSERT INTO products (sku, name, price) VALUES ($1, 'Validation Product', 99.99) ON CONFLICT (sku) DO NOTHING`,
      [validSku]
    );

    await pool.query(
      `INSERT INTO inventory (sku, stock_quantity, version) VALUES ($1, $2, 1) ON CONFLICT (sku) DO UPDATE SET stock_quantity = $2`,
      [validSku, initialStock]
    );
  });

  afterAll(async () => {
    await closeRedisConnection();
    await pool.end();
  });

  describe('1. SKU Validation', () => {
    it('should reject missing SKU with 400', async () => {
      const res = await request(app)
        .post('/api/orders')
        .send({ quantity: 1, customerEmail: 'valid@example.com' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('sku');
    });

    it('should reject empty SKU string with 400', async () => {
      const res = await request(app)
        .post('/api/orders')
        .send({ sku: '   ', quantity: 1, customerEmail: 'valid@example.com' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('sku');
    });

    it('should reject oversized SKU string (>100 chars) with 400', async () => {
      const longSku = 'A'.repeat(101);
      const res = await request(app)
        .post('/api/orders')
        .send({ sku: longSku, quantity: 1, customerEmail: 'valid@example.com' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('sku length');
    });

    it('should reject non-existent product SKU with 404', async () => {
      const res = await request(app)
        .post('/api/orders')
        .send({ sku: 'ITEM-NONEXISTENT-SKU-999', quantity: 1, customerEmail: 'valid@example.com' });

      expect(res.status).toBe(404);
      expect(res.body.error).toContain('Product not found');
    });
  });

  describe('2. Quantity Validation', () => {
    it('should reject missing quantity with 400', async () => {
      const res = await request(app)
        .post('/api/orders')
        .send({ sku: validSku, customerEmail: 'valid@example.com' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('quantity');
    });

    it('should reject zero quantity with 400', async () => {
      const res = await request(app)
        .post('/api/orders')
        .send({ sku: validSku, quantity: 0, customerEmail: 'valid@example.com' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('quantity');
    });

    it('should reject negative quantity with 400', async () => {
      const res = await request(app)
        .post('/api/orders')
        .send({ sku: validSku, quantity: -5, customerEmail: 'valid@example.com' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('quantity');
    });

    it('should reject decimal quantity (e.g. 1.5) with 400', async () => {
      const res = await request(app)
        .post('/api/orders')
        .send({ sku: validSku, quantity: 1.5, customerEmail: 'valid@example.com' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('quantity');
    });

    it('should reject boolean or non-numeric quantity with 400', async () => {
      const res = await request(app)
        .post('/api/orders')
        .send({ sku: validSku, quantity: true, customerEmail: 'valid@example.com' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('quantity');
    });

    it('should reject quantity exceeding maximum limit (>10000) with 400', async () => {
      const res = await request(app)
        .post('/api/orders')
        .send({ sku: validSku, quantity: 10001, customerEmail: 'valid@example.com' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('maximum');
    });
  });

  describe('3. Customer Email Validation', () => {
    it('should reject missing customerEmail with 400', async () => {
      const res = await request(app)
        .post('/api/orders')
        .send({ sku: validSku, quantity: 1 });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('customerEmail');
    });

    it('should reject invalid email format with 400', async () => {
      const invalidEmails = ['invalid-email', 'user@', '@domain.com', 'user@domain'];
      for (const email of invalidEmails) {
        const res = await request(app)
          .post('/api/orders')
          .send({ sku: validSku, quantity: 1, customerEmail: email });

        expect(res.status).toBe(400);
        expect(res.body.error).toContain('customerEmail');
      }
    });
  });

  describe('4. Lock Strategy & Idempotency Key Validation', () => {
    it('should reject arbitrary unsupported lock strategy with 400', async () => {
      const res = await request(app)
        .post('/api/orders')
        .send({
          sku: validSku,
          quantity: 1,
          customerEmail: 'valid@example.com',
          lockStrategy: 'SUPER_INVALID_LOCK'
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('lockStrategy');
    });

    it('should reject oversized idempotency key (>255 chars) with 400', async () => {
      const longKey = 'K'.repeat(256);
      const res = await request(app)
        .post('/api/orders')
        .send({
          sku: validSku,
          quantity: 1,
          customerEmail: 'valid@example.com',
          idempotencyKey: longKey
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('idempotencyKey');
    });
  });

  describe('5. Side-Effect Protection & Valid Order Flow', () => {
    it('invalid request must NOT decrement inventory or stage outbox events', async () => {
      const stockBefore = await pool.query(`SELECT stock_quantity FROM inventory WHERE sku = $1`, [validSku]);
      const outboxBefore = await pool.query(`SELECT count(*) FROM outbox_events`);

      const res = await request(app)
        .post('/api/orders')
        .send({ sku: validSku, quantity: -10, customerEmail: 'bad@example.com' });

      expect(res.status).toBe(400);

      const stockAfter = await pool.query(`SELECT stock_quantity FROM inventory WHERE sku = $1`, [validSku]);
      const outboxAfter = await pool.query(`SELECT count(*) FROM outbox_events`);

      expect(stockAfter.rows[0].stock_quantity).toBe(stockBefore.rows[0].stock_quantity); // Stock unchanged!
      expect(outboxAfter.rows[0].count).toBe(outboxBefore.rows[0].count); // Outbox unchanged!
    });

    it('valid request with correct inputs succeeds end-to-end', async () => {
      const res = await request(app)
        .post('/api/orders')
        .send({
          sku: validSku,
          quantity: 2,
          customerEmail: 'happy.path@example.com',
          lockStrategy: 'PESSIMISTIC'
        });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('PENDING');
      expect(res.body.unitPrice).toBe(99.99);
      expect(res.body.totalAmount).toBe(199.98);
    });
  });

});
