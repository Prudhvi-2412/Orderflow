import pg from 'pg';
import { pool } from '../config/db.js';

export interface ReservationResult {
  success: boolean;
  sku: string;
  quantity: number;
  remainingStock: number;
  strategy: string;
  error?: string;
}

export class InventoryService {
  
  /**
   * Reserve Stock with PostgreSQL Concurrency Control
   */
  async reserveStock(
    client: pg.PoolClient | null,
    sku: string,
    quantity: number,
    strategy: 'PESSIMISTIC' | 'OPTIMISTIC' | 'NONE' = 'PESSIMISTIC'
  ): Promise<ReservationResult> {
    
    if (strategy === 'PESSIMISTIC') {
      return await this.reservePessimistic(client, sku, quantity);
    } else if (strategy === 'OPTIMISTIC') {
      return await this.reserveOptimistic(client, sku, quantity);
    } else {
      return await this.reserveUnsafe(client, sku, quantity);
    }
  }

  /**
   * PESSIMISTIC CONCURRENCY CONTROL using PostgreSQL `SELECT ... FOR UPDATE`
   * Solves 100 concurrent requests trying to buy 1 item.
   */
  private async reservePessimistic(
    dbClient: pg.PoolClient | null,
    sku: string,
    quantity: number
  ): Promise<ReservationResult> {
    const isExternalClient = !!dbClient;
    const client = dbClient || (await pool.connect());

    try {
      if (!isExternalClient) {
        await client.query('BEGIN');
      }

      // 1. Lock the row exclusively with SELECT ... FOR UPDATE
      const res = await client.query(
        `SELECT stock_quantity FROM inventory WHERE sku = $1 FOR UPDATE`,
        [sku]
      );

      if (res.rows.length === 0) {
        throw new Error(`Item ${sku} not found in inventory.`);
      }

      const currentStock = res.rows[0].stock_quantity;

      // 2. Check stock boundary
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

      // 3. Decrement stock atomically within transaction
      const updateRes = await client.query(
        `UPDATE inventory SET stock_quantity = stock_quantity - $1, updated_at = NOW() WHERE sku = $2 RETURNING stock_quantity`,
        [quantity, sku]
      );

      const remainingStock = updateRes.rows[0].stock_quantity;

      if (!isExternalClient) {
        await client.query('COMMIT');
      }

      return {
        success: true,
        sku,
        quantity,
        remainingStock,
        strategy: 'PESSIMISTIC'
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
    quantity: number
  ): Promise<ReservationResult> {
    const isExternalClient = !!dbClient;
    const client = dbClient || (await pool.connect());

    try {
      // 1. Read stock and current version without row lock
      const res = await client.query(
        `SELECT stock_quantity, version FROM inventory WHERE sku = $1`,
        [sku]
      );

      if (res.rows.length === 0) {
        throw new Error(`Item ${sku} not found in inventory.`);
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

      // 2. Atomic Compare-And-Swap update checking version
      const updateRes = await client.query(
        `UPDATE inventory 
         SET stock_quantity = stock_quantity - $1, version = version + 1, updated_at = NOW() 
         WHERE sku = $2 AND version = $3 
         RETURNING stock_quantity`,
        [quantity, sku, version]
      );

      if (updateRes.rows.length === 0) {
        // CAS failed due to concurrent modification
        return {
          success: false,
          sku,
          quantity,
          remainingStock: currentStock,
          strategy: 'OPTIMISTIC',
          error: `Concurrent modification error. Version ${version} was modified by another thread.`
        };
      }

      return {
        success: true,
        sku,
        quantity,
        remainingStock: updateRes.rows[0].stock_quantity,
        strategy: 'OPTIMISTIC'
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
    quantity: number
  ): Promise<ReservationResult> {
    const client = dbClient || (await pool.connect());
    try {
      const res = await client.query(`SELECT stock_quantity FROM inventory WHERE sku = $1`, [sku]);
      const currentStock = res.rows[0]?.stock_quantity || 0;

      // Direct write without lock protection
      const updateRes = await client.query(
        `UPDATE inventory SET stock_quantity = stock_quantity - $1 RETURNING stock_quantity`,
        [quantity, sku]
      );

      return {
        success: true,
        sku,
        quantity,
        remainingStock: updateRes.rows[0].stock_quantity,
        strategy: 'NONE'
      };
    } finally {
      if (!dbClient) client.release();
    }
  }

  /**
   * Release Stock (Compensating Transaction)
   */
  async releaseStock(sku: string, quantity: number): Promise<void> {
    await pool.query(
      `UPDATE inventory SET stock_quantity = stock_quantity + $1, updated_at = NOW() WHERE sku = $2`,
      [quantity, sku]
    );
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
