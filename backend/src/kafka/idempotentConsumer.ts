import pg from 'pg';
import { pool } from '../config/db.js';

export type TransactionalHandler = (
  topic: string,
  payload: any,
  meta: any,
  client?: pg.PoolClient
) => Promise<void>;

export interface IdempotentConsumerOptions {
  consumerGroup: string;
  handler: TransactionalHandler;
}

/**
 * Transactionally Idempotent Consumer Wrapper
 * Coordinates business state mutation and `processed_events` insertion in the SAME PostgreSQL transaction.
 * Guarantees At-Least-Once Kafka Delivery + Idempotent Business Execution.
 */
export function wrapIdempotentConsumer(options: IdempotentConsumerOptions) {
  const { consumerGroup, handler } = options;

  return async (topic: string, payload: any, meta: any) => {
    const eventId = meta?.eventId || payload?.eventId || `${topic}_${meta?.offset || 0}_${meta?.partition || 0}`;

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // 1. Check whether event was already processed in database
      const checkRes = await client.query(
        `SELECT id FROM processed_events 
         WHERE event_id = $1 AND consumer_group = $2 
         FOR UPDATE`,
        [eventId, consumerGroup]
      );

      if (checkRes.rows.length > 0) {
        console.warn(`[Idempotent Consumer] Skipped duplicate Kafka event '${eventId}' for group '${consumerGroup}'.`);
        await client.query('COMMIT');
        return;
      }

      // 2. Execute business state mutation inside transaction
      await handler(topic, payload, meta, client);

      // 3. Mark processed_events in the SAME transaction
      await client.query(
        `INSERT INTO processed_events (event_id, consumer_group)
         VALUES ($1, $2)
         ON CONFLICT (event_id, consumer_group) DO NOTHING`,
        [eventId, consumerGroup]
      );

      await client.query('COMMIT');

    } catch (err: any) {
      await client.query('ROLLBACK');
      console.error(`❌ [Idempotent Consumer] Transaction rolled back for event '${eventId}':`, err.message);
      throw err; // Re-throw to trigger Kafka retry
    } finally {
      client.release();
    }
  };
}
