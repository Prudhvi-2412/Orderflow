import request from 'supertest';
import app from '../src/server.js';
import { idempotencyService } from '../src/services/idempotencyService.js';
import { pool } from '../src/config/db.js';
import { closeRedisConnection } from '../src/redis/client.js';

describe('HTTP API Idempotency, Concurrency & Crash Recovery Test Suite', () => {

  const sku = `ITEM-CRASH-TEST-${Date.now()}`;

  beforeAll(async () => {
    await pool.query(
      `INSERT INTO products (sku, name, price) VALUES ($1, 'Crash Recovery Product', 75.00) ON CONFLICT (sku) DO NOTHING`,
      [sku]
    );

    await pool.query(
      `INSERT INTO inventory (sku, stock_quantity, version) VALUES ($1, 100, 1) ON CONFLICT (sku) DO UPDATE SET stock_quantity = 100`,
      [sku]
    );
  });

  afterAll(async () => {
    await closeRedisConnection();
    await pool.end();
  });

  it('1. PENDING record actively processing (< 60s) rejects duplicate request with 409 Conflict', async () => {
    const key = `idemp_active_pending_${Date.now()}`;
    const payload = { sku, quantity: 1, customerEmail: 'active@example.com' };

    // Insert active PENDING key (started 5 seconds ago)
    await pool.query(
      `INSERT INTO idempotency_keys (key, request_hash, status, processing_started_at)
       VALUES ($1, $2, 'PENDING', NOW() - INTERVAL '5 seconds')`,
      [key, idempotencyService.hashPayload(payload)]
    );

    const res = await request(app)
      .post('/api/orders')
      .set('Idempotency-Key', key)
      .send(payload);

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('IN_PROGRESS');
  });

  it('2 & 4. Stale PENDING record (> 60s from server crash) is safely recovered and creates 1 order', async () => {
    const key = `idemp_stale_crash_${Date.now()}`;
    const payload = { sku, quantity: 1, customerEmail: 'crash.recovered@example.com' };

    // Simulate server crash: PENDING key stuck for 90 seconds
    await pool.query(
      `INSERT INTO idempotency_keys (key, request_hash, status, processing_started_at)
       VALUES ($1, $2, 'PENDING', NOW() - INTERVAL '90 seconds')`,
      [key, idempotencyService.hashPayload(payload)]
    );

    const res = await request(app)
      .post('/api/orders')
      .set('Idempotency-Key', key)
      .send(payload);

    expect(res.status).toBe(201);
    expect(res.body.orderId).toBeDefined();

    // Verify only 1 order created in DB
    const dbCount = await pool.query(`SELECT count(*) FROM orders WHERE customer_email = 'crash.recovered@example.com'`);
    expect(parseInt(dbCount.rows[0].count)).toBe(1);
  });

  it('3. Two concurrent retries of the same stale key allow only ONE request to recover lease', async () => {
    const key = `idemp_stale_concurrent_${Date.now()}`;
    const payload = { sku, quantity: 1, customerEmail: 'concurrent.crash@example.com' };

    // Insert stale key (stuck for 120s)
    await pool.query(
      `INSERT INTO idempotency_keys (key, request_hash, status, processing_started_at)
       VALUES ($1, $2, 'PENDING', NOW() - INTERVAL '120 seconds')`,
      [key, idempotencyService.hashPayload(payload)]
    );

    // Two concurrent requests attempt to recover the stale lease
    const [r1, r2] = await Promise.all([
      request(app).post('/api/orders').set('Idempotency-Key', key).send(payload),
      request(app).post('/api/orders').set('Idempotency-Key', key).send(payload)
    ]);

    const statuses = [r1.status, r2.status];
    expect(statuses).toContain(201); // 1 request recovered & created order
    expect(statuses).toContain(409); // 1 request got 409 Conflict

    const dbCount = await pool.query(`SELECT count(*) FROM orders WHERE customer_email = 'concurrent.crash@example.com'`);
    expect(parseInt(dbCount.rows[0].count)).toBe(1);
  });

  it('5. Existing COMPLETED replay behavior still works', async () => {
    const key = `idemp_completed_replay_${Date.now()}`;
    const payload = { sku, quantity: 2, customerEmail: 'replay@example.com' };

    const res1 = await request(app).post('/api/orders').set('Idempotency-Key', key).send(payload);
    expect(res1.status).toBe(201);

    const res2 = await request(app).post('/api/orders').set('Idempotency-Key', key).send(payload);
    expect(res2.status).toBe(201);
    expect(res2.body.orderId).toBe(res1.body.orderId);
  });

  it('6. Existing FAILED retry behavior still works', async () => {
    const key = `idemp_failed_retry_${Date.now()}`;
    const payload = { sku, quantity: 1, customerEmail: 'failed.retry@example.com' };

    await pool.query(
      `INSERT INTO idempotency_keys (key, request_hash, status) VALUES ($1, $2, 'FAILED')`,
      [key, idempotencyService.hashPayload(payload)]
    );

    const res = await request(app).post('/api/orders').set('Idempotency-Key', key).send(payload);
    expect(res.status).toBe(201);
    expect(res.body.orderId).toBeDefined();
  });

});
