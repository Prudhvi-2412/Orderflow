import pg from 'pg';
import { pool } from '../config/db.js';
import { inventoryService } from '../services/inventoryService.js';
import { paymentService } from '../services/paymentService.js';
import { KAFKA_TOPICS } from '../kafka/topics.js';

export type SagaStatus =
  | 'PENDING'
  | 'INVENTORY_RESERVED'
  | 'PAYMENT_PROCESSING'
  | 'PAYMENT_COMPLETED'
  | 'FULFILLMENT_PENDING'
  | 'COMPLETED'
  | 'COMPENSATING'
  | 'CANCELLED'
  | 'FAILED';

export interface SagaState {
  orderId: string;
  sagaId: string;
  sku: string;
  quantity: number;
  totalAmount: number;
  customerEmail: string;
  status: SagaStatus;
  currentStep: string;
  completedSteps: string[];
  errorReason?: string;
}

export class SagaOrchestrator {

  /**
   * Legal Saga State Machine Transition Table:
   * Maps Target Status -> Array of valid preceding status states.
   */
  private readonly LEGAL_TRANSITIONS: Record<SagaStatus, SagaStatus[]> = {
    PENDING: [], // Initial state on creation
    INVENTORY_RESERVED: ['PENDING'],
    PAYMENT_PROCESSING: ['INVENTORY_RESERVED'],
    PAYMENT_COMPLETED: ['PAYMENT_PROCESSING'],
    FULFILLMENT_PENDING: ['PAYMENT_COMPLETED', 'PAYMENT_PROCESSING'],
    COMPLETED: ['PAYMENT_PROCESSING', 'PAYMENT_COMPLETED', 'FULFILLMENT_PENDING'],
    COMPENSATING: ['PAYMENT_PROCESSING', 'INVENTORY_RESERVED', 'PENDING', 'COMPENSATING'],
    CANCELLED: ['COMPENSATING', 'INVENTORY_RESERVED', 'PAYMENT_PROCESSING', 'PENDING'],
    FAILED: ['PENDING']
  };

  /**
   * Conditional PostgreSQL State Transition Engine
   * Enforces atomic database-level state machine boundaries. Returns true if transition succeeded.
   */
  public async transitionState(
    orderId: string,
    targetStatus: SagaStatus,
    errorReason?: string,
    client?: pg.PoolClient
  ): Promise<boolean> {
    const dbClient = client || pool;
    const allowedPreviousStates = this.LEGAL_TRANSITIONS[targetStatus] || [];

    if (allowedPreviousStates.length === 0) {
      console.warn(`[Saga Engine] Transition to '${targetStatus}' rejected: Target status has no legal preceding states.`);
      return false;
    }

    const res = await dbClient.query(
      `UPDATE orders 
       SET status = $1, error_reason = $2, updated_at = NOW() 
       WHERE order_id = $3 AND status = ANY($4::varchar[])
       RETURNING order_id, status`,
      [targetStatus, errorReason || null, orderId, allowedPreviousStates]
    );

    if (res.rows.length === 1) {
      return true;
    }

    // Diagnostics if update skipped (0 rows affected)
    const check = await dbClient.query(`SELECT status FROM orders WHERE order_id = $1`, [orderId]);
    if (check.rows.length === 0) {
      console.warn(`[Saga Engine] Transition to '${targetStatus}' skipped: Order '${orderId}' does not exist.`);
    } else {
      const currentStatus = check.rows[0].status;
      console.warn(`[Saga Engine] Transition to '${targetStatus}' skipped: Order '${orderId}' is currently in state '${currentStatus}'.`);
    }

    return false;
  }

  /**
   * Safe Recovery Worker for Stuck COMPENSATING Orders
   * Scans PostgreSQL for orders in 'COMPENSATING' state older than 30 seconds and resumes compensation.
   */
  async recoverStuckCompensations(): Promise<number> {
    const res = await pool.query(
      `SELECT o.order_id, oi.sku, oi.quantity, o.error_reason
       FROM orders o
       LEFT JOIN order_items oi ON o.order_id = oi.order_id
       WHERE o.status = 'COMPENSATING'
         AND o.updated_at < NOW() - INTERVAL '30 seconds'`
    );

    let recoveredCount = 0;
    for (const row of res.rows) {
      console.log(`[Saga Recovery] Resuming stuck compensation for order ${row.order_id}...`);
      await this.handlePaymentFailed({
        orderId: row.order_id,
        sku: row.sku || 'ITEM-DEFAULT',
        quantity: row.quantity || 1,
        error: row.error_reason || 'Crash recovery resume'
      });
      recoveredCount++;
    }

    return recoveredCount;
  }

  /**
   * Helper to retrieve current Saga State from PostgreSQL
   */
  async getSagaState(orderId: string): Promise<SagaState | null> {
    const res = await pool.query(
      `SELECT o.order_id, o.status, o.error_reason, oi.sku, oi.quantity, o.total_amount, o.customer_email
       FROM orders o
       LEFT JOIN order_items oi ON o.order_id = oi.order_id
       WHERE o.order_id = $1`,
      [orderId]
    );

    if (res.rows.length === 0) return null;
    const row = res.rows[0];

    return {
      orderId: row.order_id,
      sagaId: `saga_${row.order_id}`,
      sku: row.sku || 'ITEM-IPHONE-15',
      quantity: row.quantity || 1,
      totalAmount: parseFloat(row.total_amount || 0),
      customerEmail: row.customer_email,
      status: row.status as SagaStatus,
      currentStep: row.status,
      completedSteps: this.mapCompletedSteps(row.status),
      errorReason: row.error_reason
    };
  }

  private mapCompletedSteps(status: string): string[] {
    const steps: string[] = ['ORDER_CREATED'];
    if (['INVENTORY_RESERVED', 'PAYMENT_PROCESSING', 'PAYMENT_COMPLETED', 'COMPLETED'].includes(status)) {
      steps.push('INVENTORY_RESERVED');
    }
    if (['PAYMENT_COMPLETED', 'COMPLETED'].includes(status)) {
      steps.push('PAYMENT_COMPLETED');
    }
    if (status === 'COMPLETED') {
      steps.push('CONFIRMED');
    }
    return steps;
  }

  /**
   * Event-Driven Saga Step 1: Handle OrderCreated Event
   */
  async handleOrderCreated(payload: { orderId: string; sku: string; quantity: number; lockStrategy?: 'PESSIMISTIC' | 'OPTIMISTIC' | 'NONE' }, client?: pg.PoolClient) {
    const { orderId, sku, quantity, lockStrategy = 'PESSIMISTIC' } = payload;
    console.log(`🔄 [Saga Orchestrator] Processing OrderCreated for ${orderId}...`);

    const reservation = await inventoryService.reserveStock(client || null, sku, quantity, lockStrategy, orderId);

    if (!reservation.success) {
      console.error(`❌ [Saga Orchestrator] Inventory Reservation Failed for ${orderId}: ${reservation.error}`);
      await this.transitionState(orderId, 'FAILED', reservation.error, client);

      const dbClient = client || pool;
      await dbClient.query(
        `INSERT INTO outbox_events (event_id, topic, payload, status)
         VALUES ($1, $2, $3, 'PENDING')
         ON CONFLICT (event_id) DO NOTHING`,
        [`evt_inv_fail_${orderId}`, KAFKA_TOPICS.ORDERS_CANCELLED, JSON.stringify({ orderId, reason: reservation.error })]
      );
      return;
    }

    const transitioned = await this.transitionState(orderId, 'INVENTORY_RESERVED', undefined, client);
    if (!transitioned) {
      console.warn(`[Saga Orchestrator] OrderCreated transition to INVENTORY_RESERVED skipped for ${orderId}.`);
      return;
    }

    const dbClient = client || pool;
    await dbClient.query(
      `INSERT INTO outbox_events (event_id, topic, payload, status)
       VALUES ($1, $2, $3, 'PENDING')
       ON CONFLICT (event_id) DO NOTHING`,
      [`evt_inv_res_${orderId}`, KAFKA_TOPICS.INVENTORY_RESERVED, JSON.stringify({ orderId, sku, quantity })]
    );
  }

  /**
   * Event-Driven Saga Step 2: Handle InventoryReserved Event -> Trigger Payment Outside DB Txn,
   * then finalize Payment + Order State + Outbox Event inside ONE PostgreSQL Transaction (P0-1)
   */
  async handleInventoryReserved(payload: { orderId: string; sku: string; quantity: number }) {
    const { orderId } = payload;
    const saga = await this.getSagaState(orderId);
    if (!saga) return;

    if (saga.status === 'COMPLETED' || saga.status === 'CANCELLED' || saga.status === 'FAILED') {
      console.log(`ℹ️ [Saga Orchestrator] Order ${orderId} already in terminal state '${saga.status}'. Skipping.`);
      return;
    }

    console.log(`🔄 [Saga Orchestrator] Processing InventoryReserved for ${orderId}. Initiating Payment...`);
    const startPayment = await this.transitionState(orderId, 'PAYMENT_PROCESSING');
    if (!startPayment) {
      console.warn(`[Saga Orchestrator] Transition to PAYMENT_PROCESSING skipped for ${orderId}.`);
      return;
    }

    const paymentIdempotencyKey = `pay_${orderId}`;

    try {
      // External payment call (WITHOUT holding DB transaction open)
      const paymentResult = await paymentService.processPayment(
        orderId,
        saga.totalAmount,
        saga.customerEmail,
        paymentIdempotencyKey
      );

      // P0-1: ALL local DB mutations that finalize payment, order, and outbox event happen in ONE PostgreSQL transaction
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        // 1. Persist payment result safely & idempotently
        await client.query(
          `INSERT INTO payments (order_id, txn_id, idempotency_key, amount, status)
           VALUES ($1, $2, $3, $4, 'SUCCESS')
           ON CONFLICT (order_id) DO UPDATE SET status = 'SUCCESS', txn_id = EXCLUDED.txn_id, amount = EXCLUDED.amount`,
          [orderId, paymentResult.txnId, paymentIdempotencyKey, saga.totalAmount]
        );

        // 2. Conditionally transition order: PAYMENT_PROCESSING -> COMPLETED
        const completed = await this.transitionState(orderId, 'COMPLETED', undefined, client);

        // 3. Stage outbox event using SAME stable event_id
        if (completed) {
          await client.query(
            `INSERT INTO outbox_events (event_id, topic, payload, status)
             VALUES ($1, $2, $3, 'PENDING')
             ON CONFLICT (event_id) DO NOTHING`,
            [`evt_pay_ok_${orderId}`, KAFKA_TOPICS.ORDERS_CONFIRMED, JSON.stringify({
              orderId,
              txnId: paymentResult.txnId,
              totalAmount: saga.totalAmount,
              customerEmail: saga.customerEmail
            })]
          );
        } else {
          // If order reached COMPLETED previously, ensure outbox event exists
          const checkOrder = await client.query(`SELECT status FROM orders WHERE order_id = $1`, [orderId]);
          if (checkOrder.rows[0]?.status === 'COMPLETED') {
            await client.query(
              `INSERT INTO outbox_events (event_id, topic, payload, status)
               VALUES ($1, $2, $3, 'PENDING')
               ON CONFLICT (event_id) DO NOTHING`,
              [`evt_pay_ok_${orderId}`, KAFKA_TOPICS.ORDERS_CONFIRMED, JSON.stringify({
                orderId,
                txnId: paymentResult.txnId,
                totalAmount: saga.totalAmount,
                customerEmail: saga.customerEmail
              })]
            );
          }
        }

        await client.query('COMMIT');
        console.log(`✅ [Saga Orchestrator] Saga Completed Successfully for Order ${orderId}.`);

      } catch (dbErr: any) {
        await client.query('ROLLBACK');
        throw dbErr;
      } finally {
        client.release();
      }

    } catch (paymentErr: any) {
      console.warn(`⚠️ [Saga Orchestrator] Payment Failed for ${orderId}. Initiating Saga Compensation...`);
      await this.handlePaymentFailed({ orderId, sku: saga.sku, quantity: saga.quantity, error: paymentErr.message });
    }
  }

  /**
   * Compensating Action: Handle Payment Failed -> Release Inventory Idempotently & Cancel Order
   */
  async handlePaymentFailed(payload: { orderId: string; sku: string; quantity: number; error: string }, client?: pg.PoolClient) {
    const { orderId, sku, quantity, error } = payload;

    const startCompensation = await this.transitionState(orderId, 'COMPENSATING', `Payment Failure: ${error}`, client);
    if (!startCompensation && (await this.getSagaState(orderId))?.status !== 'COMPENSATING') {
      console.warn(`[Saga Orchestrator] Transition to COMPENSATING skipped for ${orderId} (already terminal or in invalid state).`);
      return;
    }

    // 1. Idempotent Compensation: Release Reserved Inventory
    await inventoryService.releaseStock(sku, quantity, orderId);

    await this.transitionState(orderId, 'CANCELLED', `Payment Failure: ${error}`, client);

    const dbClient = client || pool;
    await dbClient.query(
      `INSERT INTO outbox_events (event_id, topic, payload, status)
       VALUES ($1, $2, $3, 'PENDING')
       ON CONFLICT (event_id) DO NOTHING`,
      [`evt_saga_cancel_${orderId}`, KAFKA_TOPICS.ORDERS_CANCELLED, JSON.stringify({
        orderId,
        reason: `Payment Error: ${error}`,
        compensated: true
      })]
    );

    console.log(`🛑 [Saga Orchestrator] Saga Compensating Rollback Complete for Order ${orderId}. Status: CANCELLED.`);
  }

  /**
   * Full Synchronous / Simulation Saga Execution
   */
  async executeSaga(
    orderId: string,
    sku: string,
    quantity: number,
    price: number,
    customerEmail: string,
    lockStrategy: 'PESSIMISTIC' | 'OPTIMISTIC' | 'NONE' = 'PESSIMISTIC'
  ): Promise<SagaState> {
    const totalAmount = price * quantity;

    await this.handleOrderCreated({ orderId, sku, quantity, lockStrategy });

    let state = await this.getSagaState(orderId);
    if (state?.status === 'FAILED') {
      return state;
    }

    await this.handleInventoryReserved({ orderId, sku, quantity });
    state = await this.getSagaState(orderId);

    return state || {
      orderId,
      sagaId: `saga_${orderId}`,
      sku,
      quantity,
      totalAmount,
      customerEmail,
      status: 'CANCELLED',
      currentStep: 'CANCELLED',
      completedSteps: []
    };
  }
}

export const sagaOrchestrator = new SagaOrchestrator();
