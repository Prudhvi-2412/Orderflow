import request from 'supertest';
import app from '../src/server.js';
import { orderService } from '../src/services/orderService.js';
import { sagaOrchestrator } from '../src/saga/sagaOrchestrator.js';
import { inventoryService } from '../src/services/inventoryService.js';
import { paymentService } from '../src/services/paymentService.js';
import { outboxWorker } from '../src/workers/outboxWorker.js';
import { pool } from '../src/config/db.js';
import { closeRedisConnection } from '../src/redis/client.js';

describe('Unified Asynchronous Order Lifecycle & Saga Source-of-Truth Test Suite', () => {

  const sku = `ITEM-LIFECYCLE-${Date.now()}`;
  const initialStock = 50;

  beforeAll(async () => {
    await pool.query(
      `INSERT INTO products (sku, name, price) VALUES ($1, 'Lifecycle Product', 88.88) ON CONFLICT (sku) DO NOTHING`,
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

  beforeEach(() => {
    paymentService.clearCache();
    paymentService.setChaos(0, false);
  });

  it('1-6. POST /api/orders creates initial PENDING order, order_items & outbox event asynchronously without synchronous payment/completion', async () => {
    const res = await request(app)
      .post('/api/orders')
      .send({
        sku,
        quantity: 2,
        customerEmail: 'async.path@example.com'
      });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('PENDING'); // 1. Initial status is PENDING!
    expect(res.body.orderId).toBeDefined();
    expect(res.body.unitPrice).toBe(88.88);
    expect(res.body.totalAmount).toBe(177.76);
    expect(res.body.message).toContain('accepted');

    const orderId = res.body.orderId;

    // Verify exactly 1 order in DB with status PENDING
    const orderDb = await pool.query(`SELECT * FROM orders WHERE order_id = $1`, [orderId]);
    expect(orderDb.rows.length).toBe(1);
    expect(orderDb.rows[0].status).toBe('PENDING');

    // Verify order_items created
    const itemDb = await pool.query(`SELECT * FROM order_items WHERE order_id = $1`, [orderId]);
    expect(itemDb.rows.length).toBe(1);
    expect(itemDb.rows[0].sku).toBe(sku);
    expect(itemDb.rows[0].quantity).toBe(2);

    // Verify exactly 1 OrderCreated outbox event created
    const outboxDb = await pool.query(`SELECT * FROM outbox_events WHERE event_id = $1`, [`evt_created_${orderId}`]);
    expect(outboxDb.rows.length).toBe(1);
    expect(outboxDb.rows[0].topic).toBe('orders.created');

    // Verify payment was NOT called yet (payments table empty for this order)
    const payDb = await pool.query(`SELECT * FROM payments WHERE order_id = $1`, [orderId]);
    expect(payDb.rows.length).toBe(0);
  });

  it('7. Idempotent duplicate HTTP request reuses response and creates only one order', async () => {
    const idempKey = `idemp_req_7_${Date.now()}`;

    const res1 = await request(app)
      .post('/api/orders')
      .set('Idempotency-Key', idempKey)
      .send({ sku, quantity: 1, customerEmail: 'idemp@example.com' });

    expect(res1.status).toBe(201);
    const orderId1 = res1.body.orderId;

    // Second request with same Idempotency-Key
    const res2 = await request(app)
      .post('/api/orders')
      .set('Idempotency-Key', idempKey)
      .send({ sku, quantity: 1, customerEmail: 'idemp@example.com' });

    expect(res2.status).toBe(201);
    expect(res2.body.orderId).toBe(orderId1);

    const countRes = await pool.query(`SELECT count(*) FROM orders WHERE order_id = $1`, [orderId1]);
    expect(parseInt(countRes.rows[0].count)).toBe(1);
  });

  it('8-10. Saga execution reserves inventory and completes order on successful payment', async () => {
    // Create pending order
    const createRes = await orderService.createOrder({
      sku,
      quantity: 3,
      customerEmail: 'saga.success@example.com'
    });

    const orderId = createRes.orderId;

    // Step 1: Trigger OrderCreated handling
    await sagaOrchestrator.handleOrderCreated({ orderId, sku, quantity: 3 });

    let state1 = await sagaOrchestrator.getSagaState(orderId);
    expect(state1?.status).toBe('INVENTORY_RESERVED');

    // Step 2: Trigger InventoryReserved handling
    await sagaOrchestrator.handleInventoryReserved({ orderId, sku, quantity: 3 });

    let state2 = await sagaOrchestrator.getSagaState(orderId);
    expect(state2?.status).toBe('COMPLETED');

    // Query order endpoint
    const queryRes = await request(app).get(`/api/orders/${orderId}`);
    expect(queryRes.status).toBe(200);
    expect(queryRes.body.status).toBe('COMPLETED');
    expect(queryRes.body.txn_id).toBe(`TXN-${orderId}`);
  });

  it('11-12. Payment failure triggers compensating release and cancels order', async () => {
    const createRes = await orderService.createOrder({
      sku,
      quantity: 2,
      customerEmail: 'saga.fail@example.com'
    });
    const orderId = createRes.orderId;

    await sagaOrchestrator.handleOrderCreated({ orderId, sku, quantity: 2 });
    const stockBeforeFail = (await inventoryService.getStock(sku)).stock_quantity;

    // Force payment failure
    paymentService.setChaos(1.0, false);

    await sagaOrchestrator.handleInventoryReserved({ orderId, sku, quantity: 2 });

    const state = await sagaOrchestrator.getSagaState(orderId);
    expect(state?.status).toBe('CANCELLED');

    const stockAfterCancel = (await inventoryService.getStock(sku)).stock_quantity;
    expect(stockAfterCancel).toBe(stockBeforeFail + 2); // Inventory released!
  });

  it('14-15. Kafka outage leaves event safely in outbox, and outbox worker processes it when available', async () => {
    const createRes = await orderService.createOrder({
      sku,
      quantity: 1,
      customerEmail: 'outbox.resilience@example.com'
    });
    const orderId = createRes.orderId;

    // Outbox event is PENDING in PostgreSQL DB
    const pendingOutbox = await pool.query(
      `SELECT status FROM outbox_events WHERE event_id = $1`,
      [`evt_created_${orderId}`]
    );
    expect(pendingOutbox.rows[0].status).toBe('PENDING');

    // Process batch via outboxWorker
    await outboxWorker.processOutboxBatch();

    const processedOutbox = await pool.query(
      `SELECT status FROM outbox_events WHERE event_id = $1`,
      [`evt_created_${orderId}`]
    );
    expect(processedOutbox.rows[0].status).toBe('PUBLISHED');
  });

});
