import pg from 'pg';
import { pool } from '../config/db.js';

export interface ReservationResult {
  success: boolean;
  sku: string;
  quantity: number;
  remainingStock: number;
  strategy: string;
  error?: string;
  orderId?: string;
  isDuplicate?: boolean;
}

export class InventoryService {
  
  /**
   * Reserve Stock with PostgreSQL Concurrency Control & Idempotent Reservation Tracking
   */
  async reserveStock(
    client: pg.PoolClient | null,
    sku: string,
    quantity: number,
    strategy: 'PESSIMISTIC' | 'OPTIMISTIC' | 'NONE' = 'PESSIMISTIC',
    orderId?: string
  ): Promise<ReservationResult> {
    
    if (!quantity || quantity <= 0) {
      return {
        success: false,
        sku,
        quantity,
        remainingStock: 0,
        strategy,
        error: 'Invalid quantity: quantity must be greater than 0'
      };
    }

    if (strategy === 'PESSIMISTIC') {
      return await this.reservePessimistic(client, sku, quantity, orderId);
    } else if (strategy === 'OPTIMISTIC') {
      return await this.reserveOptimistic(client, sku, quantity, orderId);
    } else {
      return await this.reserveUnsafe(client, sku, quantity, orderId);
    }
  }

  /**
   * PESSIMISTIC CONCURRENCY CONTROL using PostgreSQL `SELECT ... FOR UPDATE` & Atomic Stock Deduction
   */
  private async reservePessimistic(
    dbClient: pg.PoolClient | null,
    sku: string,
    quantity: number,
    orderId?: string
  ): Promise<ReservationResult> {
    const isExternalClient = !!dbClient;
    const client = dbClient || (await pool.connect());

    try {
      if (!isExternalClient) {
        await client.query('BEGIN');
      }

      // 1. Check for existing reservation if orderId is provided (Idempotency Check)
      if (orderId) {
        const existingRes = await client.query(
          `SELECT status, quantity FROM inventory_reservations WHERE order_id = $1 FOR UPDATE`,
          [orderId]
        );

        if (existingRes.rows.length > 0 && existingRes.rows[0].status === 'RESERVED') {
          const currentStockRes = await client.query(`SELECT stock_quantity FROM inventory WHERE sku = $1`, [sku]);
          const remainingStock = currentStockRes.rows[0]?.stock_quantity ?? 0;

          if (!isExternalClient) await client.query('COMMIT');

          return {
            success: true,
            sku,
            quantity: existingRes.rows[0].quantity,
            remainingStock,
            strategy: 'PESSIMISTIC',
            orderId,
            isDuplicate: true
          };
        }
      }

      // 2. Lock the row exclusively with SELECT ... FOR UPDATE
      const res = await client.query(
        `SELECT stock_quantity FROM inventory WHERE sku = $1 FOR UPDATE`,
        [sku]
      );

      if (res.rows.length === 0) {
        if (!isExternalClient) await client.query('ROLLBACK');
        return {
          success: false,
          sku,
          quantity,
          remainingStock: 0,
          strategy: 'PESSIMISTIC',
          error: `SKU ${sku} not found in inventory.`
        };
      }

      const currentStock = res.rows[0].stock_quantity;

      // 3. Check stock boundary
      if (currentStock < quantity) {
        if (!isExternalClient) await client.query('ROLLBACK');
        return {
          success: false,
          sku,
          quantity,
          remainingStock: currentStock,
          strategy: 'PESSIMISTIC',
          error: `Insufficient stock for ${sku}. Requested: ${quantity}, Available: ${currentStock}`
        };
      }

      // 4. Decrement stock atomically within transaction using stock_quantity >= quantity boundary check
      const updateRes = await client.query(
        `UPDATE inventory 
         SET stock_quantity = stock_quantity - $1, updated_at = NOW() 
         WHERE sku = $2 AND stock_quantity >= $1 
         RETURNING stock_quantity`,
        [quantity, sku]
      );

      if (updateRes.rows.length === 0) {
        if (!isExternalClient) await client.query('ROLLBACK');
        return {
          success: false,
          sku,
          quantity,
          remainingStock: currentStock,
          strategy: 'PESSIMISTIC',
          error: `Insufficient stock for ${sku}. Requested: ${quantity}, Available: ${currentStock}`
        };
      }

      const remainingStock = updateRes.rows[0].stock_quantity;

      // 5. Record Reservation State for Idempotent Compensation Tracking
      if (orderId) {
        await client.query(
          `INSERT INTO inventory_reservations (order_id, sku, quantity, status)
           VALUES ($1, $2, $3, 'RESERVED')
           ON CONFLICT (order_id) DO UPDATE SET status = 'RESERVED', updated_at = NOW()`,
          [orderId, sku, quantity]
        );
      }

      if (!isExternalClient) {
        await client.query('COMMIT');
      }

      return {
        success: true,
        sku,
        quantity,
        remainingStock,
        strategy: 'PESSIMISTIC',
        orderId
      };

    } catch (err: any) {
      if (!isExternalClient) await client.query('ROLLBACK');
      throw err;
    } finally {
      if (!isExternalClient) client.release();
    }
  }

  /**
   * OPTIMISTIC CONCURRENCY CONTROL (Compare-And-Swap Versioning)
   */
  private async reserveOptimistic(
    dbClient: pg.PoolClient | null,
    sku: string,
    quantity: number,
    orderId?: string
  ): Promise<ReservationResult> {
    const isExternalClient = !!dbClient;
    const client = dbClient || (await pool.connect());

    try {
      if (orderId) {
        const existingRes = await client.query(
          `SELECT status, quantity FROM inventory_reservations WHERE order_id = $1`,
          [orderId]
        );

        if (existingRes.rows.length > 0 && existingRes.rows[0].status === 'RESERVED') {
          const currentStockRes = await client.query(`SELECT stock_quantity FROM inventory WHERE sku = $1`, [sku]);
          return {
            success: true,
            sku,
            quantity: existingRes.rows[0].quantity,
            remainingStock: currentStockRes.rows[0]?.stock_quantity ?? 0,
            strategy: 'OPTIMISTIC',
            orderId,
            isDuplicate: true
          };
        }
      }

      const res = await client.query(
        `SELECT stock_quantity, version FROM inventory WHERE sku = $1`,
        [sku]
      );

      if (res.rows.length === 0) {
        return {
          success: false,
          sku,
          quantity,
          remainingStock: 0,
          strategy: 'OPTIMISTIC',
          error: `SKU ${sku} not found in inventory.`
        };
      }

      const { stock_quantity: currentStock, version } = res.rows[0];

      if (currentStock < quantity) {
        return {
          success: false,
          sku,
          quantity,
          remainingStock: currentStock,
          strategy: 'OPTIMISTIC',
          error: `Out of stock. Requested: ${quantity}, Available: ${currentStock}`
        };
      }

      const updateRes = await client.query(
        `UPDATE inventory 
         SET stock_quantity = stock_quantity - $1, version = version + 1, updated_at = NOW() 
         WHERE sku = $2 AND version = $3 AND stock_quantity >= $1 
         RETURNING stock_quantity`,
        [quantity, sku, version]
      );

      if (updateRes.rows.length === 0) {
        return {
          success: false,
          sku,
          quantity,
          remainingStock: currentStock,
          strategy: 'OPTIMISTIC',
          error: `Concurrent modification error. Version ${version} was modified by another thread.`
        };
      }

      if (orderId) {
        await client.query(
          `INSERT INTO inventory_reservations (order_id, sku, quantity, status)
           VALUES ($1, $2, $3, 'RESERVED')
           ON CONFLICT (order_id) DO UPDATE SET status = 'RESERVED', updated_at = NOW()`,
          [orderId, sku, quantity]
        );
      }

      return {
        success: true,
        sku,
        quantity,
        remainingStock: updateRes.rows[0].stock_quantity,
        strategy: 'OPTIMISTIC',
        orderId
      };

    } finally {
      if (!isExternalClient) client.release();
    }
  }

  /**
   * UNSAFE RESERVATION (Demonstrates Race Condition & Overselling)
   */
  private async reserveUnsafe(
    dbClient: pg.PoolClient | null,
    sku: string,
    quantity: number,
    orderId?: string
  ): Promise<ReservationResult> {
    const client = dbClient || (await pool.connect());
    try {
      const updateRes = await client.query(
        `UPDATE inventory SET stock_quantity = stock_quantity - $1 WHERE sku = $2 RETURNING stock_quantity`,
        [quantity, sku]
      );

      if (orderId) {
        await client.query(
          `INSERT INTO inventory_reservations (order_id, sku, quantity, status)
           VALUES ($1, $2, $3, 'RESERVED')
           ON CONFLICT (order_id) DO UPDATE SET status = 'RESERVED', updated_at = NOW()`,
          [orderId, sku, quantity]
        );
      }

      return {
        success: true,
        sku,
        quantity,
        remainingStock: updateRes.rows[0]?.stock_quantity ?? 0,
        strategy: 'NONE',
        orderId
      };
    } finally {
      if (!dbClient) client.release();
    }
  }

  /**
   * Release Stock (ATOMIC & IDEMPOTENT Compensating Transaction)
   * Guaranteed: duplicate or concurrent release calls for the same reservation identity (orderId)
   * will update reservation state RESERVED -> RELEASED exactly once, and restore stock exactly once.
   */
  async releaseStock(sku: string, quantity: number, orderId?: string): Promise<{ released: boolean }> {
    const trackingId = orderId || `adhoc_release_${sku}_${quantity}`;
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // 1. Atomic conditional update on reservation record (RESERVED -> RELEASED)
      const resUpdate = await client.query(
        `UPDATE inventory_reservations 
         SET status = 'RELEASED', updated_at = NOW() 
         WHERE order_id = $1 AND status = 'RESERVED' 
         RETURNING id`,
        [trackingId]
      );

      let wasFirstRelease = (resUpdate.rowCount ?? 0) > 0;

      // 2. Handle ad-hoc release or missing reservation row safely
      if (!wasFirstRelease) {
        const checkRes = await client.query(
          `SELECT status FROM inventory_reservations WHERE order_id = $1 FOR UPDATE`,
          [trackingId]
        );

        if (checkRes.rows.length === 0) {
          // No reservation record existed prior -> Insert as RELEASED and perform initial stock release
          const insertRes = await client.query(
            `INSERT INTO inventory_reservations (order_id, sku, quantity, status)
             VALUES ($1, $2, $3, 'RELEASED')
             ON CONFLICT (order_id) DO NOTHING
             RETURNING id`,
            [trackingId, sku, quantity]
          );
          wasFirstRelease = (insertRes.rowCount ?? 0) > 0;
        } else {
          // Reservation record exists and status is already 'RELEASED' -> NO-OP!
          wasFirstRelease = false;
        }
      }

      // 3. Increment stock ONLY on the first release execution
      if (wasFirstRelease) {
        await client.query(
          `UPDATE inventory SET stock_quantity = stock_quantity + $1, updated_at = NOW() WHERE sku = $2`,
          [quantity, sku]
        );
      }

      await client.query('COMMIT');
      return { released: wasFirstRelease };

    } catch (err: any) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Get Stock Info
   */
  async getStock(sku: string) {
    const res = await pool.query(`SELECT * FROM inventory WHERE sku = $1`, [sku]);
    return res.rows[0] || null;
  }
}

export const inventoryService = new InventoryService();
