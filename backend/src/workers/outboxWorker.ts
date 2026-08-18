import crypto from 'crypto';
import { pool } from '../config/db.js';
import { kafkaProducer } from '../kafka/producer.js';
import { KafkaTopic } from '../kafka/topics.js';

export interface OutboxEventRow {
  id: number;
  event_id: string;
  topic: string;
  payload: any;
  attempts: number;
  claimToken: string;
}

export class OutboxWorker {
  private isRunning = false;
  private pollIntervalMs = 500;
  private batchSize = 50;
  private leaseTimeoutSeconds = 30; // Workers can re-claim stuck 'PROCESSING' rows after 30s lease expiry

  async start(): Promise<void> {
    this.isRunning = true;
    console.log('⚡ Transactional Outbox Worker started. Polling outbox_events table...');

    while (this.isRunning) {
      try {
        await this.processOutboxBatch();
      } catch (err: any) {
        console.error('❌ Outbox Worker Error:', err.message);
      }

      await new Promise((r) => setTimeout(r, this.pollIntervalMs));
    }
  }

  stop(): void {
    this.isRunning = false;
    console.log('🛑 Transactional Outbox Worker stopped.');
  }

  /**
   * Non-Blocking 3-Phase Outbox Processor:
   * 1. CLAIM (Short DB Txn using FOR UPDATE SKIP LOCKED + unique claim_token UUID)
   * 2. PUBLISH (Network I/O to Kafka outside DB Txn)
   * 3. MARK OUTCOME (Short DB Txn conditionally matching claim_token to prevent slow worker lease overwrites)
   */
  async processOutboxBatch(): Promise<number> {
    // ----------------------------------------------------
    // PHASE 1: CLAIM EVENTS (Short Transaction 1)
    // ----------------------------------------------------
    const claimedRows: OutboxEventRow[] = [];
    const claimClient = await pool.connect();

    try {
      await claimClient.query('BEGIN');

      // Select eligible events using FOR UPDATE SKIP LOCKED (Multi-worker concurrency safe)
      const selectRes = await claimClient.query(
        `SELECT id, event_id, topic, payload, attempts 
         FROM outbox_events 
         WHERE (status = 'PENDING' AND (next_retry_at IS NULL OR next_retry_at <= NOW()))
            OR (status = 'PROCESSING' AND processing_started_at < NOW() - (INTERVAL '1 second' * $1))
         ORDER BY id ASC 
         LIMIT $2 
         FOR UPDATE SKIP LOCKED`,
        [this.leaseTimeoutSeconds, this.batchSize]
      );

      if (selectRes.rows.length === 0) {
        await claimClient.query('COMMIT');
        return 0;
      }

      const idsToClaim = selectRes.rows.map(r => r.id);
      const batchClaimToken = crypto.randomUUID();

      // Transition claimed rows to PROCESSING state with timestamp AND unique claim_token
      await claimClient.query(
        `UPDATE outbox_events 
         SET status = 'PROCESSING', processing_started_at = NOW(), claim_token = $1 
         WHERE id = ANY($2::int[])`,
        [batchClaimToken, idsToClaim]
      );

      await claimClient.query('COMMIT');

      for (const row of selectRes.rows) {
        claimedRows.push({
          id: row.id,
          event_id: row.event_id,
          topic: row.topic,
          payload: typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload,
          attempts: row.attempts,
          claimToken: batchClaimToken
        });
      }

    } catch (err: any) {
      await claimClient.query('ROLLBACK');
      throw err;
    } finally {
      claimClient.release(); // DB Txn 1 committed & released BEFORE calling Kafka!
    }

    if (claimedRows.length === 0) return 0;

    // ----------------------------------------------------
    // PHASE 2 & 3: PUBLISH TO KAFKA & MARK OUTCOME (Outside Txn 1)
    // ----------------------------------------------------
    let publishedCount = 0;

    for (const row of claimedRows) {
      const { id, event_id, topic, payload, attempts, claimToken } = row;
      const sagaId = payload.orderId || payload.sagaId || event_id;

      let success = false;
      let publishErr: string | null = null;

      try {
        // Publish to Kafka using STABLE event_id
        success = await kafkaProducer.publish(
          topic as KafkaTopic,
          sagaId,
          payload,
          { eventId: event_id, sagaId }
        );
      } catch (err: any) {
        success = false;
        publishErr = err.message;
      }

      // Mark outcome in PostgreSQL with CLAIM TOKEN VERIFICATION (Short Transaction 2)
      const markClient = await pool.connect();
      try {
        await markClient.query('BEGIN');

        if (success) {
          const updateRes = await markClient.query(
            `UPDATE outbox_events 
             SET status = 'PUBLISHED', processed_at = NOW(), processing_started_at = NULL, claim_token = NULL, error = NULL 
             WHERE id = $1 AND claim_token = $2`,
            [id, claimToken]
          );

          if (updateRes.rowCount && updateRes.rowCount > 0) {
            publishedCount++;
          } else {
            console.warn(`⚠️ [Outbox Worker] Event ${event_id} status update skipped: Worker lost lease (reclaimed by another worker).`);
          }
        } else {
          const nextAttempts = attempts + 1;
          const maxAttempts = 10;
          const isFinalFailure = nextAttempts >= maxAttempts;
          // Exponential backoff: 2^attempts seconds (e.g. 2s, 4s, 8s...)
          const backoffSeconds = Math.min(Math.pow(2, nextAttempts), 300);

          await markClient.query(
            `UPDATE outbox_events 
             SET attempts = $1, 
                 status = $2, 
                 next_retry_at = NOW() + (INTERVAL '1 second' * $3), 
                 processing_started_at = NULL, 
                 claim_token = NULL,
                 error = $4 
             WHERE id = $5 AND claim_token = $6`,
            [
              nextAttempts,
              isFinalFailure ? 'FAILED' : 'PENDING',
              backoffSeconds,
              publishErr || 'Kafka Publish Failed',
              id,
              claimToken
            ]
          );
        }

        await markClient.query('COMMIT');
      } catch (err: any) {
        await markClient.query('ROLLBACK');
        console.error(`❌ Failed to update outbox status for event ${event_id}:`, err.message);
      } finally {
        markClient.release();
      }
    }

    return publishedCount;
  }
}

export const outboxWorker = new OutboxWorker();

if (process.argv[1] && process.argv[1].includes('outboxWorker.ts')) {
  outboxWorker.start();
}
