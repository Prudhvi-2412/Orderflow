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
  private redisTTL = 86400; // 24 hours TTL
  private leaseTimeoutSeconds = 60; // 60s lease timeout for crash recovery of stuck PENDING keys

  /**
   * Compute deterministic SHA-256 hash of payload ignoring volatile metadata fields
   */
  public hashPayload(payload: any): string {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return crypto.createHash('sha256').update(JSON.stringify(payload || {})).digest('hex');
    }

    // Strip volatile request metadata fields to compute a deterministic canonical hash
    const { idempotencyKey, timestamp, _t, ...canonicalData } = payload;
    const jsonStr = JSON.stringify(canonicalData);
    return crypto.createHash('sha256').update(jsonStr).digest('hex');
  }

  /**
   * Begin Idempotency Lifecycle Check with Atomic DB Claiming & Crash Recovery
   */
  async begin(key: string, payload: any): Promise<IdempotencyCheckResult> {
    const payloadHash = this.hashPayload(payload);
    const redisKey = `idemp:${key}`;

    // 1. FAST PATH: Check Redis Cache
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
          const now = Date.now();
          const startedAt = data.startedAt || now;
          if (now - startedAt < this.leaseTimeoutSeconds * 1000) {
            return {
              action: 'IN_PROGRESS',
              error: `Request with Idempotency-Key '${key}' is currently being processed.`,
              statusCode: 409
            };
          }
        }
        if (data.status === 'COMPLETED') {
          return {
            action: 'SERVE_CACHE',
            response: data.responseBody,
            statusCode: 201
          };
        }
      }
    } catch (redisErr) {
      // Redis fallback -> proceed to PostgreSQL
    }

    // 2. ATOMIC CLAIM in PostgreSQL: Attempt to INSERT first
    const insertRes = await pool.query(
      `INSERT INTO idempotency_keys (key, request_hash, status, processing_started_at)
       VALUES ($1, $2, 'PENDING', NOW())
       ON CONFLICT (key) DO NOTHING
       RETURNING id, key, request_hash, status`,
      [key, payloadHash]
    );

    // If 1 row returned -> Current request successfully claimed ownership!
    if (insertRes.rows.length === 1) {
      try {
        await redis.setex(redisKey, this.redisTTL, JSON.stringify({
          requestHash: payloadHash,
          status: 'PENDING',
          startedAt: Date.now()
        }));
      } catch (e) {}

      return { action: 'EXECUTE' };
    }

    // 3. KEY ALREADY EXISTS -> Inspect existing record to handle duplicate, payload mismatch, or crash recovery
    const dbRes = await pool.query(
      `SELECT key, request_hash, status, response_body, processing_started_at FROM idempotency_keys WHERE key = $1`,
      [key]
    );

    if (dbRes.rows.length > 0) {
      const row = dbRes.rows[0];

      // Payload Mismatch Check
      if (row.request_hash !== payloadHash) {
        return {
          action: 'PAYLOAD_MISMATCH',
          error: `Idempotency-Key '${key}' reused with different request payload parameters.`,
          statusCode: 422
        };
      }

      if (row.status === 'PENDING') {
        const startedAtMs = row.processing_started_at ? new Date(row.processing_started_at).getTime() : Date.now();
        const isStale = (Date.now() - startedAtMs) > (this.leaseTimeoutSeconds * 1000);

        if (!isStale) {
          // Fresh PENDING request -> still processing!
          return {
            action: 'IN_PROGRESS',
            error: `Request with Idempotency-Key '${key}' is currently in progress.`,
            statusCode: 409
          };
        }

        // STALE PENDING REQUEST (Server crashed) -> Attempt atomic lease recovery
        const recoverRes = await pool.query(
          `UPDATE idempotency_keys
           SET request_hash = $1, processing_started_at = NOW(), updated_at = NOW()
           WHERE key = $2 
             AND status = 'PENDING' 
             AND processing_started_at < NOW() - (INTERVAL '1 second' * $3)
           RETURNING id`,
          [payloadHash, key, this.leaseTimeoutSeconds]
        );

        if (recoverRes.rows.length === 1) {
          // Successfully recovered lease!
          try {
            await redis.setex(redisKey, this.redisTTL, JSON.stringify({
              requestHash: payloadHash,
              status: 'PENDING',
              startedAt: Date.now()
            }));
          } catch (e) {}

          return { action: 'EXECUTE' };
        } else {
          // Another concurrent request recovered it first
          return {
            action: 'IN_PROGRESS',
            error: `Request with Idempotency-Key '${key}' is currently being re-processed.`,
            statusCode: 409
          };
        }
      }

      if (row.status === 'COMPLETED') {
        // Backfill Redis cache
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
          statusCode: 201
        };
      }

      if (row.status === 'FAILED') {
        // Allow client retry on previously failed execution
        await pool.query(
          `UPDATE idempotency_keys 
           SET status = 'PENDING', request_hash = $1, processing_started_at = NOW(), response_body = NULL, updated_at = NOW() 
           WHERE key = $2`,
          [payloadHash, key]
        );

        try {
          await redis.setex(redisKey, this.redisTTL, JSON.stringify({
            requestHash: payloadHash,
            status: 'PENDING',
            startedAt: Date.now()
          }));
        } catch (e) {}

        return { action: 'EXECUTE' };
      }
    }

    return { action: 'EXECUTE' };
  }

  /**
   * Complete Idempotency Lifecycle & Persist Response Body
   */
  async complete(key: string, payload: any, responseBody: any): Promise<void> {
    const payloadHash = this.hashPayload(payload);
    const redisKey = `idemp:${key}`;

    await pool.query(
      `UPDATE idempotency_keys 
       SET status = 'COMPLETED', response_body = $1, updated_at = NOW() 
       WHERE key = $2`,
      [JSON.stringify(responseBody), key]
    );

    try {
      await redis.setex(redisKey, this.redisTTL, JSON.stringify({
        requestHash: payloadHash,
        status: 'COMPLETED',
        responseBody
      }));
    } catch (e) {}
  }

  /**
   * Mark Idempotency Record as FAILED (Allows Immediate Retry)
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
