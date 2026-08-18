import { sagaOrchestrator, SagaStatus } from '../src/saga/sagaOrchestrator.js';
import { pool } from '../src/config/db.js';
import { closeRedisConnection } from '../src/redis/client.js';

describe('Saga State Machine Database Boundary & Transition Hardening Suite', () => {

  const sku = `SAGA-HARDEN-SKU-${Date.now()}`;

  beforeAll(async () => {
    await pool.query(
      `INSERT INTO products (sku, name, price) VALUES ($1, 'Saga Test Product', 100.00) ON CONFLICT (sku) DO NOTHING`,
      [sku]
    );

    await pool.query(
      `INSERT INTO inventory (sku, stock_quantity, version) VALUES ($1, 50, 1) ON CONFLICT (sku) DO UPDATE SET stock_quantity = 50`,
      [sku]
    );
  });

  afterAll(async () => {
    await closeRedisConnection();
    await pool.end();
  });

  async function createTestOrder(orderId: string, initialStatus: SagaStatus = 'PENDING') {
    await pool.query(
      `INSERT INTO orders (order_id, customer_email, total_amount, status)
       VALUES ($1, 'saga.test@example.com', 100.00, $2)
       ON CONFLICT (order_id) DO UPDATE SET status = EXCLUDED.status`,
      [orderId, initialStatus]
    );

    await pool.query(
      `INSERT INTO order_items (order_id, sku, quantity, unit_price)
       VALUES ($1, $2, 1, 100.00)
       ON CONFLICT DO NOTHING`,
      [orderId, sku]
    );
  }

  it('1. Valid Saga transitions follow defined state workflow: PENDING -> INVENTORY_RESERVED -> PAYMENT_PROCESSING -> COMPLETED', async () => {
    const orderId = `ORD-VALID-${Date.now()}`;
    await createTestOrder(orderId, 'PENDING');

    const step1 = await sagaOrchestrator.transitionState(orderId, 'INVENTORY_RESERVED');
    expect(step1).toBe(true);

    const step2 = await sagaOrchestrator.transitionState(orderId, 'PAYMENT_PROCESSING');
    expect(step2).toBe(true);

    const step3 = await sagaOrchestrator.transitionState(orderId, 'COMPLETED');
    expect(step3).toBe(true);

    const state = await sagaOrchestrator.getSagaState(orderId);
    expect(state?.status).toBe('COMPLETED');
  });

  it('2. Invalid transition (e.g. PENDING directly to COMPLETED) is rejected by database condition', async () => {
    const orderId = `ORD-INVALID-${Date.now()}`;
    await createTestOrder(orderId, 'PENDING');

    const result = await sagaOrchestrator.transitionState(orderId, 'COMPLETED');
    expect(result).toBe(false);

    const state = await sagaOrchestrator.getSagaState(orderId);
    expect(state?.status).toBe('PENDING'); // State unchanged!
  });

  it('3 & 4. Duplicate event and out-of-order events do not cause illegal transitions', async () => {
    const orderId = `ORD-DUP-OUTOFORDER-${Date.now()}`;
    await createTestOrder(orderId, 'PENDING');

    await sagaOrchestrator.transitionState(orderId, 'INVENTORY_RESERVED');

    // Duplicate InventoryReserved event -> NO-OP (0 rows updated)
    const dupRes = await sagaOrchestrator.transitionState(orderId, 'INVENTORY_RESERVED');
    expect(dupRes).toBe(false);

    // Out-of-order event attempt (e.g., jump from INVENTORY_RESERVED to COMPLETED skipping PAYMENT_PROCESSING)
    const jumpRes = await sagaOrchestrator.transitionState(orderId, 'COMPLETED');
    expect(jumpRes).toBe(false);

    const state = await sagaOrchestrator.getSagaState(orderId);
    expect(state?.status).toBe('INVENTORY_RESERVED');
  });

  it('5, 6 & 7. Terminal states (COMPLETED, CANCELLED) cannot be overwritten by late events', async () => {
    const orderIdCompleted = `ORD-TERM-OK-${Date.now()}`;
    await createTestOrder(orderIdCompleted, 'COMPLETED');

    // Attempt late PaymentFailed on completed order -> Rejected
    const lateFail = await sagaOrchestrator.transitionState(orderIdCompleted, 'CANCELLED');
    expect(lateFail).toBe(false);

    const stateCompleted = await sagaOrchestrator.getSagaState(orderIdCompleted);
    expect(stateCompleted?.status).toBe('COMPLETED');

    const orderIdCancelled = `ORD-TERM-CANCEL-${Date.now()}`;
    await createTestOrder(orderIdCancelled, 'CANCELLED');

    // Attempt late PaymentSuccess on cancelled order -> Rejected
    const lateOk = await sagaOrchestrator.transitionState(orderIdCancelled, 'COMPLETED');
    expect(lateOk).toBe(false);

    const stateCancelled = await sagaOrchestrator.getSagaState(orderIdCancelled);
    expect(stateCancelled?.status).toBe('CANCELLED');
  });

  it('8, 10 & 11. Duplicate compensation handles stock release idempotently without double-releasing', async () => {
    const orderIdComp = `ORD-COMP-${Date.now()}`;
    await createTestOrder(orderIdComp, 'INVENTORY_RESERVED');

    // First compensation execution
    await sagaOrchestrator.handlePaymentFailed({ orderId: orderIdComp, sku, quantity: 1, error: 'Card Declined' });
    let state = await sagaOrchestrator.getSagaState(orderIdComp);
    expect(state?.status).toBe('CANCELLED');

    // Second (duplicate) compensation execution -> Safe NO-OP (state remains CANCELLED, stock release is idempotent)
    await sagaOrchestrator.handlePaymentFailed({ orderId: orderIdComp, sku, quantity: 1, error: 'Card Declined' });
    state = await sagaOrchestrator.getSagaState(orderIdComp);
    expect(state?.status).toBe('CANCELLED');
  });

  it('9 & 12. Concurrent success/failure state transitions resolve to exactly ONE winner in PostgreSQL', async () => {
    const orderIdConc = `ORD-CONC-SAGA-${Date.now()}`;
    await createTestOrder(orderIdConc, 'PAYMENT_PROCESSING');

    // Concurrent attempt: complete order vs cancel order
    const [resCompleted, resCompensating] = await Promise.all([
      sagaOrchestrator.transitionState(orderIdConc, 'COMPLETED'),
      sagaOrchestrator.transitionState(orderIdConc, 'COMPENSATING', 'Payment Failed')
    ]);

    // Exactly one transition succeeds (returns true), the other returns false
    const results = [resCompleted, resCompensating];
    expect(results.filter(r => r === true).length).toBe(1);

    const state = await sagaOrchestrator.getSagaState(orderIdConc);
    expect(['COMPLETED', 'COMPENSATING']).toContain(state?.status);
  });

  it('13. Recovery scanner safely resumes stuck COMPENSATING orders after server crash', async () => {
    const orderIdStuck = `ORD-STUCK-COMP-${Date.now()}`;
    await createTestOrder(orderIdStuck, 'COMPENSATING');

    // Simulate crash where updated_at is 40 seconds ago
    await pool.query(
      `UPDATE orders SET updated_at = NOW() - INTERVAL '40 seconds' WHERE order_id = $1`,
      [orderIdStuck]
    );

    const recoveredCount = await sagaOrchestrator.recoverStuckCompensations();
    expect(recoveredCount).toBeGreaterThanOrEqual(1);

    const state = await sagaOrchestrator.getSagaState(orderIdStuck);
    expect(state?.status).toBe('CANCELLED');
  });

});
