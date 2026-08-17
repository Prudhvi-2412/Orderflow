import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

let dbUrl = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/orderflow';
if (dbUrl.includes('sslmode=require') && !dbUrl.includes('uselibpqcompat=true')) {
  dbUrl = dbUrl.replace('sslmode=require', 'uselibpqcompat=true&sslmode=require');
}

const isCloud = dbUrl.includes('neon.tech') || dbUrl.includes('sslmode=require');

export const pool = new Pool({
  connectionString: dbUrl,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  ssl: isCloud ? { rejectUnauthorized: false } : undefined
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
