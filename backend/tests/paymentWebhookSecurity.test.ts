import request from 'supertest';
import crypto from 'crypto';
import app from '../src/server.js';
import { pool } from '../src/config/db.js';
import { sagaOrchestrator } from '../src/saga/sagaOrchestrator.js';
import { closeRedisConnection } from '../src/redis/client.js';

describe('Payment Webhook Authenticity, HMAC Verification & Saga Protection Suite', () => {

  const secret = process.env.WEBHOOK_SECRET || 'whsec_test_secret_1234567890';
  const sku = `WH-SKU-${Date.now()}`;

  beforeAll(async () => {
    await pool.query(
      `INSERT INTO products (sku, name, price) VALUES ($1, 'Webhook Product', 50.00) ON CONFLICT (sku) DO NOTHING`,
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

  function generateSignature(timestamp: number | string, payloadStr: string): string {
    const signedPayload = `${timestamp}.${payloadStr}`;
    return crypto
      .createHmac('sha256', secret)
      .update(signedPayload)
      .digest('hex');
  }

  async function setupTestOrder(orderId: string, initialStatus: string = 'PAYMENT_PROCESSING') {
    await pool.query(
      `INSERT INTO orders (order_id, customer_email, total_amount, status)
       VALUES ($1, 'wh.test@example.com', 50.00, $2)
       ON CONFLICT (order_id) DO UPDATE SET status = EXCLUDED.status`,
      [orderId, initialStatus]
    );
  }

  it('1 & 11. Valid current timestamp + valid signature is accepted (200 OK) and executes Saga transition', async () => {
    const orderId = `ORD-WH-OK-${Date.now()}`;
    await setupTestOrder(orderId, 'PAYMENT_PROCESSING');

    const timestamp = Date.now();
    const payload = {
      eventId: `wh_evt_ok_${Date.now()}`,
      eventType: 'payment.succeeded',
      orderId,
      amount: 50.00
    };

    const payloadStr = JSON.stringify(payload);
    const signature = generateSignature(timestamp, payloadStr);

    const res = await request(app)
      .post('/api/webhooks/payment')
      .set('x-webhook-signature', signature)
      .set('x-webhook-timestamp', String(timestamp))
      .set('Content-Type', 'application/json')
      .send(payloadStr);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('SUCCESS');

    // Verify order transitioned to COMPLETED
    const state = await sagaOrchestrator.getSagaState(orderId);
    expect(state?.status).toBe('COMPLETED');
  });

  it('2. Valid signature + timestamp exactly within tolerance (e.g. 2 mins ago) is accepted', async () => {
    const orderId = `ORD-WH-TOL-${Date.now()}`;
    await setupTestOrder(orderId, 'PAYMENT_PROCESSING');

    const timestamp = Date.now() - (2 * 60 * 1000); // 2 minutes ago
    const payload = {
      eventId: `wh_evt_tol_${Date.now()}`,
      eventType: 'payment.succeeded',
      orderId,
      amount: 50.00
    };

    const payloadStr = JSON.stringify(payload);
    const signature = generateSignature(timestamp, payloadStr);

    const res = await request(app)
      .post('/api/webhooks/payment')
      .set('x-webhook-signature', signature)
      .set('x-webhook-timestamp', String(timestamp))
      .set('Content-Type', 'application/json')
      .send(payloadStr);

    expect(res.status).toBe(200);
  });

  it('3. Timestamp older than tolerance (e.g. 10 mins ago) is rejected (401 Unauthorized)', async () => {
    const timestamp = Date.now() - (10 * 60 * 1000); // 10 minutes ago
    const payload = {
      eventId: `wh_evt_stale_${Date.now()}`,
      eventType: 'payment.succeeded',
      orderId: 'ORD-WH-STALE'
    };

    const payloadStr = JSON.stringify(payload);
    const signature = generateSignature(timestamp, payloadStr);

    const res = await request(app)
      .post('/api/webhooks/payment')
      .set('x-webhook-signature', signature)
      .set('x-webhook-timestamp', String(timestamp))
      .set('Content-Type', 'application/json')
      .send(payloadStr);

    expect(res.status).toBe(401);
    expect(res.body.error).toContain('outside tolerance window');
  });

  it('4. Future-dated timestamp beyond tolerance (e.g. +10 mins) is rejected (401 Unauthorized)', async () => {
    const timestamp = Date.now() + (10 * 60 * 1000); // +10 minutes in future
    const payload = {
      eventId: `wh_evt_future_${Date.now()}`,
      eventType: 'payment.succeeded',
      orderId: 'ORD-WH-FUTURE'
    };

    const payloadStr = JSON.stringify(payload);
    const signature = generateSignature(timestamp, payloadStr);

    const res = await request(app)
      .post('/api/webhooks/payment')
      .set('x-webhook-signature', signature)
      .set('x-webhook-timestamp', String(timestamp))
      .set('Content-Type', 'application/json')
      .send(payloadStr);

    expect(res.status).toBe(401);
    expect(res.body.error).toContain('outside tolerance window');
  });

  it('5. Missing timestamp header returns 400 Bad Request', async () => {
    const payload = {
      eventId: `wh_evt_notime_${Date.now()}`,
      eventType: 'payment.succeeded',
      orderId: 'ORD-WH-NOTIME'
    };

    const res = await request(app)
      .post('/api/webhooks/payment')
      .set('x-webhook-signature', 'some_sig')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify(payload));

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Missing webhook timestamp');
  });

  it('6. Malformed timestamp header returns 400 Bad Request', async () => {
    const payload = {
      eventId: `wh_evt_malformed_time_${Date.now()}`,
      eventType: 'payment.succeeded',
      orderId: 'ORD-WH-MAL'
    };

    const res = await request(app)
      .post('/api/webhooks/payment')
      .set('x-webhook-signature', 'some_sig')
      .set('x-webhook-timestamp', 'NOT_A_NUMBER')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify(payload));

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Malformed webhook timestamp');
  });

  it('7. Modified timestamp with old signature is rejected (401 Unauthorized)', async () => {
    const originalTime = Date.now();
    const payload = {
      eventId: `wh_evt_mod_time_${Date.now()}`,
      eventType: 'payment.succeeded',
      orderId: 'ORD-WH-MODTIME'
    };

    const payloadStr = JSON.stringify(payload);
    const signature = generateSignature(originalTime, payloadStr);

    // Attacker modifies timestamp to current time using old signature
    const newTime = originalTime + 1000;

    const res = await request(app)
      .post('/api/webhooks/payment')
      .set('x-webhook-signature', signature)
      .set('x-webhook-timestamp', String(newTime))
      .set('Content-Type', 'application/json')
      .send(payloadStr);

    expect(res.status).toBe(401);
    expect(res.body.error).toContain('Invalid webhook signature');
  });

  it('8. Modified body with old signature is rejected (401 Unauthorized)', async () => {
    const timestamp = Date.now();
    const originalPayload = {
      eventId: `wh_evt_tamper_${Date.now()}`,
      eventType: 'payment.succeeded',
      orderId: 'ORD-WH-TAMPER',
      amount: 50.00
    };

    const signature = generateSignature(timestamp, JSON.stringify(originalPayload));

    // Tampered payload (amount changed)
    const tamperedPayload = { ...originalPayload, amount: 0.01 };

    const res = await request(app)
      .post('/api/webhooks/payment')
      .set('x-webhook-signature', signature)
      .set('x-webhook-timestamp', String(timestamp))
      .set('Content-Type', 'application/json')
      .send(JSON.stringify(tamperedPayload));

    expect(res.status).toBe(401);
    expect(res.body.error).toContain('Invalid webhook signature');
  });

  it('9. Duplicate valid webhook is safely ignored as NO-OP (HTTP 200)', async () => {
    const orderId = `ORD-WH-DUP-${Date.now()}`;
    await setupTestOrder(orderId, 'PAYMENT_PROCESSING');

    const timestamp = Date.now();
    const eventId = `wh_evt_dup_${Date.now()}`;
    const payload = {
      eventId,
      eventType: 'payment.succeeded',
      orderId,
      amount: 50.00
    };

    const payloadStr = JSON.stringify(payload);
    const signature = generateSignature(timestamp, payloadStr);

    // 1st Webhook call -> Processed
    const res1 = await request(app)
      .post('/api/webhooks/payment')
      .set('x-webhook-signature', signature)
      .set('x-webhook-timestamp', String(timestamp))
      .set('Content-Type', 'application/json')
      .send(payloadStr);

    expect(res1.status).toBe(200);
    expect(res1.body.status).toBe('SUCCESS');

    // 2nd (Replayed) Webhook call with SAME eventId -> Deduplicated safely
    const res2 = await request(app)
      .post('/api/webhooks/payment')
      .set('x-webhook-signature', signature)
      .set('x-webhook-timestamp', String(timestamp))
      .set('Content-Type', 'application/json')
      .send(payloadStr);

    expect(res2.status).toBe(200);
    expect(res2.body.message).toContain('Duplicate webhook event safely ignored');
  });

  it('10. Invalid/stale webhook produces ZERO processed_events writes', async () => {
    const eventId = `wh_evt_zero_write_${Date.now()}`;
    const timestamp = Date.now() - (15 * 60 * 1000); // 15 mins ago (stale)
    const payload = {
      eventId,
      eventType: 'payment.succeeded',
      orderId: 'ORD-WH-ZEROWRITE'
    };

    const payloadStr = JSON.stringify(payload);
    const signature = generateSignature(timestamp, payloadStr);

    const res = await request(app)
      .post('/api/webhooks/payment')
      .set('x-webhook-signature', signature)
      .set('x-webhook-timestamp', String(timestamp))
      .set('Content-Type', 'application/json')
      .send(payloadStr);

    expect(res.status).toBe(401);

    // Verify processed_events has NO record for eventId
    const dbRes = await pool.query(`SELECT * FROM processed_events WHERE event_id = $1`, [eventId]);
    expect(dbRes.rows.length).toBe(0);
  });

  it('12. Late webhook after terminal state does not mutate order state', async () => {
    const orderId = `ORD-WH-LATE-${Date.now()}`;
    await setupTestOrder(orderId, 'COMPLETED');

    const timestamp = Date.now();
    const payload = {
      eventId: `wh_evt_late_${Date.now()}`,
      eventType: 'payment.failed',
      orderId,
      sku,
      quantity: 1,
      error: 'Late failure callback'
    };

    const payloadStr = JSON.stringify(payload);
    const signature = generateSignature(timestamp, payloadStr);

    const res = await request(app)
      .post('/api/webhooks/payment')
      .set('x-webhook-signature', signature)
      .set('x-webhook-timestamp', String(timestamp))
      .set('Content-Type', 'application/json')
      .send(payloadStr);

    expect(res.status).toBe(200);

    // Verify order state remains COMPLETED
    const state = await sagaOrchestrator.getSagaState(orderId);
    expect(state?.status).toBe('COMPLETED');
  });

});
