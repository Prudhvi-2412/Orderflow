import { pool } from '../config/db.js';
import { kafkaProducer } from '../kafka/producer.js';
import { KafkaTopic } from '../kafka/topics.js';

export class OutboxWorker {
  private isRunning = false;
  private pollIntervalMs = 500;
  private batchSize = 50;

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
   * Fetch and publish pending outbox events safely using PostgreSQL FOR UPDATE SKIP LOCKED
   */
  async processOutboxBatch(): Promise<number> {
    const client = await pool.connect();
    let processedCount = 0;

    try {
      await client.query('BEGIN');

      // 1. Lock pending outbox rows exclusively, skipping locked rows to allow multi-worker scaling
      const res = await client.query(
        `SELECT id, event_id, topic, payload, attempts 
         FROM outbox_events 
         WHERE status = 'PENDING' AND attempts < 5
         ORDER BY id ASC 
         LIMIT $1 
         FOR UPDATE SKIP LOCKED`,
        [this.batchSize]
      );

      if (res.rows.length === 0) {
        await client.query('COMMIT');
        return 0;
      }

      for (const row of res.rows) {
        const { id, event_id, topic, payload, attempts } = row;
        const sagaId = payload.orderId || payload.sagaId || event_id;

        // 2. Publish event to Apache Kafka
        const success = await kafkaProducer.publish(
          topic as KafkaTopic,
          sagaId,
          payload,
          { eventId: event_id, sagaId }
        );

        if (success) {
          // 3. Mark Outbox Row as PUBLISHED
          await client.query(
            `UPDATE outbox_events 
             SET status = 'PUBLISHED', processed_at = NOW(), error = NULL 
             WHERE id = $1`,
            [id]
          );
          processedCount++;
        } else {
          // 4. Increment failure attempts
          const nextAttempts = attempts + 1;
          const nextStatus = nextAttempts >= 5 ? 'FAILED' : 'PENDING';
          await client.query(
            `UPDATE outbox_events 
             SET attempts = $1, status = $2, error = 'Kafka Publish Failure' 
             WHERE id = $3`,
            [nextAttempts, nextStatus, id]
          );
        }
      }

      await client.query('COMMIT');
      return processedCount;

    } catch (err: any) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}

export const outboxWorker = new OutboxWorker();

if (process.argv[1] && process.argv[1].includes('outboxWorker.ts')) {
  outboxWorker.start();
}
