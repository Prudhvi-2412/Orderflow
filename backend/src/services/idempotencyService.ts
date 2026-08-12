import crypto from 'crypto';
import { pool } from '../config/db.js';
import { redis } from '../redis/client.js';

export interface IdempotencyCheckResult {
  action: 'EXECUTE' | 'SERVE_CACHE' | 'PAYLOAD_MISMATCH' | 'IN_PROGRESS';
  response?: any;
  error?: string;
  statusCode?: number;
}

export class IdempotencyService {
  private redisTTL = 86400; // 24 hours in seconds

  /**
   * Compute deterministic SHA-256 hash of payload
   */
  private hashPayload(payload: any): string {
    const jsonStr = JSON.stringify(payload || {});
    return crypto.createHash('sha256').update(jsonStr).digest('hex');
  }

  /**
   * Begin Idempotency Lifecycle Check
   */
  async begin(key: string, payload: any): Promise<IdempotencyCheckResult> {
    const payloadHash = this.hashPayload(payload);
    const redisKey = `idemp:${key}`;

    // 1. FAST PATH: Check Redis Cache (Sub-millisecond)
    try {
      const cached = await redis.get(redisKey);
      if (cached) {
        const data = JSON.parse(cached);
        if (data.requestHash !== payloadHash) {
          return {
            action: 'PAYLOAD_MISMATCH',
            error: `Idempotency-Key '${key}' reused with different request payload parameters.`,
            statusCode: 422
          };
        }
        if (data.status === 'PENDING') {
          return {
            action: 'IN_PROGRESS',
            error: `Request with Idempotency-Key '${key}' is currently being processed.`,
            statusCode: 409
          };
        }
        if (data.status === 'COMPLETED') {
          return {
            action: 'SERVE_CACHE',
            response: data.responseBody,
            statusCode: 200
          };
        }
      }
    } catch (redisErr) {
      // Redis unavailable; fall through to PostgreSQL durable table
    }

    // 2. SLOW/DURABLE PATH: Check PostgreSQL `idempotency_keys` table
    const dbRes = await pool.query(`SELECT * FROM idempotency_keys WHERE key = $1`, [key]);

    if (dbRes.rows.length > 0) {
      const row = dbRes.rows[0];

      if (row.request_hash !== payloadHash) {
        return {
          action: 'PAYLOAD_MISMATCH',
          error: `Idempotency-Key '${key}' reused with different request payload parameters.`,
          statusCode: 422
        };
      }

      if (row.status === 'PENDING') {
        return {
          action: 'IN_PROGRESS',
          error: `Request with Idempotency-Key '${key}' is currently in progress.`,
          statusCode: 409
        };
      }

      if (row.status === 'COMPLETED') {
        // Backfill Redis Cache
        try {
          await redis.setex(redisKey, this.redisTTL, JSON.stringify({
            requestHash: row.request_hash,
            status: 'COMPLETED',
            responseBody: row.response_body
          }));
        } catch (e) {}

        return {
          action: 'SERVE_CACHE',
          response: row.response_body,
          statusCode: 200
        };
      }
    }

    // 3. FIRST REQUEST: Stage `PENDING` state in PostgreSQL & Redis
    await pool.query(
      `INSERT INTO idempotency_keys (key, request_hash, status)
       VALUES ($1, $2, 'PENDING')
       ON CONFLICT (key) DO NOTHING`,
      [key, payloadHash]
    );

    try {
      await redis.setex(redisKey, this.redisTTL, JSON.stringify({
        requestHash: payloadHash,
        status: 'PENDING'
      }));
    } catch (e) {}

    return { action: 'EXECUTE' };
  }

  /**
   * Complete Idempotency Lifecycle & Persist Response
   */
  async complete(key: string, payload: any, responseBody: any): Promise<void> {
    const payloadHash = this.hashPayload(payload);
    const redisKey = `idemp:${key}`;

    // 1. Update PostgreSQL Durable Record
    await pool.query(
      `UPDATE idempotency_keys 
       SET status = 'COMPLETED', response_body = $1, updated_at = NOW() 
       WHERE key = $2`,
      [JSON.stringify(responseBody), key]
    );

    // 2. Update Redis Cache
    try {
      await redis.setex(redisKey, this.redisTTL, JSON.stringify({
        requestHash: payloadHash,
        status: 'COMPLETED',
        responseBody
      }));
    } catch (e) {}
  }

  /**
   * Mark Idempotency Record as FAILED
   */
  async fail(key: string): Promise<void> {
    const redisKey = `idemp:${key}`;
    await pool.query(`UPDATE idempotency_keys SET status = 'FAILED', updated_at = NOW() WHERE key = $1`, [key]);
    try {
      await redis.del(redisKey);
    } catch (e) {}
  }
}

export const idempotencyService = new IdempotencyService();
