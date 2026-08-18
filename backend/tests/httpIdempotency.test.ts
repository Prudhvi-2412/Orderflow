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

    const dbCount = await pool.query(`SELECT count(*) FROM orders WHERE customer_email = 'crash.recovered@example.com'`);
    expect(parseInt(dbCount.rows[0].count)).toBe(1);
  });

  it('3. Two concurrent retries of the same stale key allow only ONE request to recover lease', async () => {
    const key = `idemp_stale_concurrent_${Date.now()}`;
    const payload = { sku, quantity: 1, customerEmail: 'concurrent.crash@example.com' };

    await pool.query(
      `INSERT INTO idempotency_keys (key, request_hash, status, processing_started_at)
       VALUES ($1, $2, 'PENDING', NOW() - INTERVAL '120 seconds')`,
      [key, idempotencyService.hashPayload(payload)]
    );

    const [r1, r2] = await Promise.all([
      request(app).post('/api/orders').set('Idempotency-Key', key).send(payload),
      request(app).post('/api/orders').set('Idempotency-Key', key).send(payload)
    ]);

    const statuses = [r1.status, r2.status];
    expect(statuses).toContain(201);
    expect(statuses).toContain(409);

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

  it('7. P1-1: Stale worker with lost claim_token cannot modify active idempotency record', async () => {
    const key = `idemp_token_lease_${Date.now()}`;
    const payload = { sku, quantity: 1, customerEmail: 'token.test@example.com' };
    const staleToken = 'token-AAA-stale';

    // Worker A claims key with token AAA (and becomes stale)
    await pool.query(
      `INSERT INTO idempotency_keys (key, request_hash, status, processing_started_at, claim_token)
       VALUES ($1, $2, 'PENDING', NOW() - INTERVAL '100 seconds', $3)`,
      [key, idempotencyService.hashPayload(payload), staleToken]
    );

    // Worker B recovers key with token BBB
    const beginRes = await idempotencyService.begin(key, payload);
    expect(beginRes.action).toBe('EXECUTE');
    const activeToken = beginRes.claimToken;
    expect(activeToken).toBeDefined();
    expect(activeToken).not.toBe(staleToken);

    // Stale Worker A attempts complete with token AAA -> 0 rows modified (returns false)
    const staleCompleteSuccess = await idempotencyService.complete(key, payload, { result: 'stale' }, staleToken);
    expect(staleCompleteSuccess).toBe(false);

    // Stale Worker A attempts fail with token AAA -> 0 rows modified (returns false)
    const staleFailSuccess = await idempotencyService.fail(key, staleToken);
    expect(staleFailSuccess).toBe(false);

    // Active Worker B completes with token BBB -> 1 row modified (returns true)
    const activeCompleteSuccess = await idempotencyService.complete(key, payload, { result: 'valid' }, activeToken);
    expect(activeCompleteSuccess).toBe(true);

    const check = await pool.query(`SELECT status, response_body FROM idempotency_keys WHERE key = $1`, [key]);
    expect(check.rows[0].status).toBe('COMPLETED');
    expect(check.rows[0].response_body.result).toBe('valid');
  });

});
