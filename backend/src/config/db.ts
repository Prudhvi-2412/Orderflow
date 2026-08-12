import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/orderflow',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

/**
 * DB Client Wrapper for PostgreSQL ACID Transactions & SELECT FOR UPDATE Locks
 */
export class DBClient {
  private client: pg.PoolClient | null = null;

  static async getClient(): Promise<pg.PoolClient> {
    return await pool.connect();
  }

  static async query(text: string, params?: any[]) {
    return await pool.query(text, params);
  }
}
