import pg from 'pg';
import { pool } from '../config/db.js';
import { inventoryService } from '../services/inventoryService.js';
import { paymentService } from '../services/paymentService.js';
import { kafkaProducer } from '../kafka/producer.js';
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
   * Helper to retrieve or initialize Saga State from PostgreSQL
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

    const reservation = await inventoryService.reserveStock(client || null, sku, quantity, lockStrategy);

    if (!reservation.success) {
      console.error(`❌ [Saga Orchestrator] Inventory Reservation Failed for ${orderId}: ${reservation.error}`);
      await this.updateStatus(orderId, 'FAILED', reservation.error, client);

      const dbClient = client || pool;
      await dbClient.query(
        `INSERT INTO outbox_events (event_id, topic, payload, status)
         VALUES ($1, $2, $3, 'PENDING')`,
        [`evt_inv_fail_${Date.now()}`, KAFKA_TOPICS.ORDERS_CANCELLED, JSON.stringify({ orderId, reason: reservation.error })]
      );
      return;
    }

    await this.updateStatus(orderId, 'INVENTORY_RESERVED', undefined, client);

    const dbClient = client || pool;
    await dbClient.query(
      `INSERT INTO outbox_events (event_id, topic, payload, status)
       VALUES ($1, $2, $3, 'PENDING')`,
      [`evt_inv_res_${Date.now()}`, KAFKA_TOPICS.INVENTORY_RESERVED, JSON.stringify({ orderId, sku, quantity })]
    );
  }

  /**
   * Event-Driven Saga Step 2: Handle InventoryReserved Event -> Trigger Payment
   */
  async handleInventoryReserved(payload: { orderId: string; sku: string; quantity: number }, client?: pg.PoolClient) {
    const { orderId } = payload;
    const saga = await this.getSagaState(orderId);
    if (!saga) return;

    console.log(`🔄 [Saga Orchestrator] Processing InventoryReserved for ${orderId}. Initiating Payment...`);
    await this.updateStatus(orderId, 'PAYMENT_PROCESSING', undefined, client);

    try {
      const paymentResult = await paymentService.processPayment(orderId, saga.totalAmount, saga.customerEmail);

      const dbClient = client || pool;
      await dbClient.query(
        `INSERT INTO payments (order_id, txn_id, amount, status)
         VALUES ($1, $2, $3, 'SUCCESS')`,
        [orderId, paymentResult.txnId, saga.totalAmount]
      );

      await this.updateStatus(orderId, 'COMPLETED', undefined, client);

      await dbClient.query(
        `INSERT INTO outbox_events (event_id, topic, payload, status)
         VALUES ($1, $2, $3, 'PENDING')`,
        [`evt_pay_ok_${Date.now()}`, KAFKA_TOPICS.ORDERS_CONFIRMED, JSON.stringify({
          orderId,
          txnId: paymentResult.txnId,
          totalAmount: saga.totalAmount,
          customerEmail: saga.customerEmail
        })]
      );

      console.log(`✅ [Saga Orchestrator] Saga Completed Successfully for Order ${orderId}.`);

    } catch (paymentErr: any) {
      console.warn(`⚠️ [Saga Orchestrator] Payment Failed for ${orderId}. Initiating Saga Compensation...`);
      await this.handlePaymentFailed({ orderId, sku: saga.sku, quantity: saga.quantity, error: paymentErr.message }, client);
    }
  }

  /**
   * Compensating Action: Handle Payment Failed -> Release Inventory & Cancel Order
   */
  async handlePaymentFailed(payload: { orderId: string; sku: string; quantity: number; error: string }, client?: pg.PoolClient) {
    const { orderId, sku, quantity, error } = payload;

    await this.updateStatus(orderId, 'COMPENSATING', `Payment Failure: ${error}`, client);

    // Release Reserved Inventory
    await inventoryService.releaseStock(sku, quantity);

    await this.updateStatus(orderId, 'CANCELLED', `Payment Failure: ${error}`, client);

    const dbClient = client || pool;
    await dbClient.query(
      `INSERT INTO outbox_events (event_id, topic, payload, status)
       VALUES ($1, $2, $3, 'PENDING')`,
      [`evt_saga_cancel_${Date.now()}`, KAFKA_TOPICS.ORDERS_CANCELLED, JSON.stringify({
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

  private async updateStatus(orderId: string, status: SagaStatus, errorReason?: string, client?: pg.PoolClient): Promise<void> {
    const dbClient = client || pool;
    await dbClient.query(
      `UPDATE orders SET status = $1, error_reason = $2, updated_at = NOW() WHERE order_id = $3`,
      [status, errorReason || null, orderId]
    );
  }
}

export const sagaOrchestrator = new SagaOrchestrator();
