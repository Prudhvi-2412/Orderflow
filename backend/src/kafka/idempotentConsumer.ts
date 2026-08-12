import { pool } from '../config/db.js';
import { EventMessageHandler } from './consumer.js';

export interface IdempotentConsumerOptions {
  consumerGroup: string;
  handler: EventMessageHandler;
}

/**
 * Idempotent Consumer Wrapper using PostgreSQL `processed_events` Table
 * Prevents duplicate processing of Kafka events across retries & crashes.
 */
export function wrapIdempotentConsumer(options: IdempotentConsumerOptions): EventMessageHandler {
  const { consumerGroup, handler } = options;

  return async (topic: string, payload: any, meta: any) => {
    const eventId = meta.eventId || payload.eventId || `${topic}_${meta.offset}_${meta.partition}`;

    // 1. Attempt Atomic Deduplication Insert into PostgreSQL
    try {
      const dbRes = await pool.query(
        `INSERT INTO processed_events (event_id, consumer_group)
         VALUES ($1, $2)
         ON CONFLICT (event_id, consumer_group) DO NOTHING
         RETURNING id`,
        [eventId, consumerGroup]
      );

      // If 0 rows returned, key already exists -> DUPLICATE EVENT DETECTED
      if (dbRes.rows.length === 0) {
        console.warn(`[Idempotent Consumer] Skipped duplicate Kafka event '${eventId}' for consumer group '${consumerGroup}'.`);
        return; // Skip handler execution safely
      }

      // 2. First-time processing -> Execute underlying business logic
      await handler(topic, payload, meta);

    } catch (err: any) {
      console.error(`❌ Idempotent Consumer Error for event '${eventId}':`, err.message);
      throw err; // Re-throw to allow Kafka retry mechanism
    }
  };
}
