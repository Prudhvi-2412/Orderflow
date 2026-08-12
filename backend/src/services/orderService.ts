import { pool } from '../config/db.js';
import { inventoryService } from './inventoryService.js';
import { paymentService } from './paymentService.js';

export interface CreateOrderRequest {
  sku: string;
  quantity: number;
  price: number;
  customerEmail: string;
  idempotencyKey: string;
  lockStrategy?: 'PESSIMISTIC' | 'OPTIMISTIC' | 'NONE';
}

export class OrderService {
  
  async createOrder(req: CreateOrderRequest) {
    const {
      sku,
      quantity,
      price,
      customerEmail,
      idempotencyKey,
      lockStrategy = 'PESSIMISTIC'
    } = req;

    const client = await pool.connect();
    const orderId = `ORD-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const totalAmount = price * quantity;

    try {
      await client.query('BEGIN');

      // 1. Create Pending Order Record
      await client.query(
        `INSERT INTO orders (order_id, customer_email, total_amount, status, lock_strategy)
         VALUES ($1, $2, $3, 'PROCESSING', $4)`,
        [orderId, customerEmail, totalAmount, lockStrategy]
      );

      await client.query(
        `INSERT INTO order_items (order_id, sku, quantity, price)
         VALUES ($1, $2, $3, $4)`,
        [orderId, sku, quantity, price]
      );

      // 2. Reserve Inventory with Concurrency Control inside same DB transaction
      const reservation = await inventoryService.reserveStock(client, sku, quantity, lockStrategy);

      if (!reservation.success) {
        await client.query(
          `UPDATE orders SET status = 'FAILED', error_reason = $1, updated_at = NOW() WHERE order_id = $2`,
          [reservation.error, orderId]
        );

        // Stage Outbox Failed Event
        await client.query(
          `INSERT INTO outbox_events (event_id, topic, payload, status)
           VALUES ($1, 'OrderFailed', $2, 'PENDING')`,
          [`evt_${Date.now()}`, JSON.stringify({ orderId, reason: reservation.error })]
        );

        await client.query('COMMIT');

        return {
          orderId,
          status: 'FAILED',
          error: reservation.error
        };
      }

      // 3. Stage OrderCreated & InventoryReserved in Outbox Table
      await client.query(
        `INSERT INTO outbox_events (event_id, topic, payload, status)
         VALUES ($1, 'OrderCreated', $2, 'PENDING')`,
        [`evt_${Date.now()}_1`, JSON.stringify({ orderId, sku, quantity, totalAmount })]
      );

      await client.query('COMMIT');

      // 4. Process Payment (External Service Call)
      try {
        const paymentResult = await paymentService.processPayment(orderId, totalAmount, customerEmail);

        // Record Payment in DB
        await pool.query(
          `INSERT INTO payments (order_id, txn_id, amount, status)
           VALUES ($1, $2, $3, 'SUCCESS')`,
          [orderId, paymentResult.txnId, totalAmount]
        );

        await pool.query(
          `UPDATE orders SET status = 'COMPLETED', updated_at = NOW() WHERE order_id = $1`,
          [orderId]
        );

        return {
          orderId,
          status: 'COMPLETED',
          sku,
          quantity,
          totalAmount,
          txnId: paymentResult.txnId
        };

      } catch (paymentErr: any) {
        // --- SAGA COMPENSATION ROLLBACK ---
        console.warn(`[OrderService] Payment failed for ${orderId}. Initiating Saga Compensation...`);

        // 1. Compensation: Release Reserved Inventory
        await inventoryService.releaseStock(sku, quantity);

        // 2. Update Order Status to CANCELLED
        await pool.query(
          `UPDATE orders SET status = 'CANCELLED', error_reason = $1, updated_at = NOW() WHERE order_id = $2`,
          [`Payment Error: ${paymentErr.message}`, orderId]
        );

        return {
          orderId,
          status: 'CANCELLED',
          error: paymentErr.message,
          compensationExecuted: true
        };
      }

    } catch (err: any) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async getOrder(orderId: string) {
    const res = await pool.query(`SELECT * FROM orders WHERE order_id = $1`, [orderId]);
    return res.rows[0] || null;
  }
}

export const orderService = new OrderService();
