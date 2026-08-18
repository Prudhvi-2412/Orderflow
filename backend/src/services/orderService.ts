import { pool } from '../config/db.js';
import { validateOrderPayload } from '../utils/orderValidator.js';
import { KAFKA_TOPICS } from '../kafka/topics.js';

export interface CreateOrderRequest {
  sku: string;
  quantity: number;
  price?: number; // Client price is strictly ignored in favor of DB price
  customerEmail: string;
  idempotencyKey?: string;
  lockStrategy?: 'PESSIMISTIC' | 'OPTIMISTIC' | 'NONE';
}

export class OrderService {
  
  /**
   * Create Initial Order & Stage OrderCreated Event in Outbox (Transaction 1)
   * Asynchronous Saga Orchestrator handles inventory reservation & payment processing.
   */
  async createOrder(req: CreateOrderRequest) {
    const validation = validateOrderPayload(req);
    if (!validation.valid || !validation.data) {
      const err: any = new Error(validation.error);
      err.statusCode = validation.statusCode || 400;
      throw err;
    }

    const {
      sku,
      quantity,
      customerEmail,
      lockStrategy = 'PESSIMISTIC'
    } = validation.data;

    const orderId = `ORD-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

    let dbUnitPrice = 0;
    let totalAmount = 0;

    // --- TRANSACTION: Create Order, Order Items & Outbox Event ---
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Authoritative Product Price Lookup from PostgreSQL
      const productRes = await client.query(
        `SELECT price FROM products WHERE sku = $1`,
        [sku]
      );

      if (productRes.rows.length === 0) {
        await client.query('ROLLBACK');
        const err: any = new Error(`Product not found for SKU: ${sku}`);
        err.statusCode = 404;
        throw err;
      }

      dbUnitPrice = parseFloat(productRes.rows[0].price);
      totalAmount = dbUnitPrice * quantity;

      // 2. Create Initial Order Record (Status: PENDING)
      await client.query(
        `INSERT INTO orders (order_id, customer_email, total_amount, status, lock_strategy)
         VALUES ($1, $2, $3, 'PENDING', $4)`,
        [orderId, customerEmail, totalAmount, lockStrategy]
      );

      // Store unit price in order_items
      await client.query(
        `INSERT INTO order_items (order_id, sku, quantity, price)
         VALUES ($1, $2, $3, $4)`,
        [orderId, sku, quantity, dbUnitPrice]
      );

      // 3. Stage OrderCreated Outbox Event in the SAME transaction
      await client.query(
        `INSERT INTO outbox_events (event_id, topic, payload, status)
         VALUES ($1, $2, $3, 'PENDING')
         ON CONFLICT (event_id) DO NOTHING`,
        [
          `evt_created_${orderId}`,
          KAFKA_TOPICS.ORDERS_CREATED,
          JSON.stringify({ orderId, sku, quantity, totalAmount, customerEmail, lockStrategy })
        ]
      );

      await client.query('COMMIT');

      return {
        orderId,
        status: 'PENDING',
        sku,
        quantity,
        unitPrice: dbUnitPrice,
        totalAmount,
        message: 'Order accepted for processing'
      };

    } catch (err: any) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async getOrder(orderId: string) {
    const res = await pool.query(
      `SELECT o.order_id, o.customer_email, o.total_amount, o.status, o.lock_strategy, o.error_reason, o.created_at, o.updated_at,
              oi.sku, oi.quantity, oi.price as unit_price, p.txn_id, p.status as payment_status
       FROM orders o
       LEFT JOIN order_items oi ON o.order_id = oi.order_id
       LEFT JOIN payments p ON o.order_id = p.order_id
       WHERE o.order_id = $1`,
      [orderId]
    );
    return res.rows[0] || null;
  }
}

export const orderService = new OrderService();
