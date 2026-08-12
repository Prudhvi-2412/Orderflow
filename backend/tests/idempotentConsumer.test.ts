import { wrapIdempotentConsumer } from '../src/kafka/idempotentConsumer.js';
import { pool } from '../src/config/db.js';

describe('Idempotent Kafka Consumer & processed_events Guard Tests', () => {

  it('should execute handler exactly once and skip subsequent duplicate Kafka events', async () => {
    const rawHandler = jest.fn().mockResolvedValue(undefined);
    const consumerGroup = 'test-payment-consumer-group';
    const eventId = `evt_dedup_${Date.now()}`;

    const wrappedHandler = wrapIdempotentConsumer({
      consumerGroup,
      handler: rawHandler
    });

    const topic = 'payment.completed';
    const payload = { orderId: 'ORD-DEDUP-100', amount: 999 };
    const meta = { eventId };

    // 1st Arrival -> Should execute handler
    await wrappedHandler(topic, payload, meta);
    expect(rawHandler).toHaveBeenCalledTimes(1);

    // 2nd Duplicate Arrival (Redelivery) -> Should skip handler execution
    await wrappedHandler(topic, payload, meta);
    expect(rawHandler).toHaveBeenCalledTimes(1); // Call count remains 1!

    // 3rd Duplicate Arrival -> Should skip handler execution
    await wrappedHandler(topic, payload, meta);
    expect(rawHandler).toHaveBeenCalledTimes(1); // Call count remains 1!

    // Verify row inserted in `processed_events`
    const dbRes = await pool.query(
      `SELECT * FROM processed_events WHERE event_id = $1 AND consumer_group = $2`,
      [eventId, consumerGroup]
    );
    expect(dbRes.rows.length).toBe(1);
  });

});
