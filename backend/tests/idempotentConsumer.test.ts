import { wrapIdempotentConsumer } from '../src/kafka/idempotentConsumer.js';
import { pool } from '../src/config/db.js';

describe('Idempotent Kafka Consumer & processed_events Guard Tests', () => {

  afterAll(async () => {
    await pool.end();
  });

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
    expect(rawHandler).toHaveBeenCalledTimes(1);

    // 3rd Duplicate Arrival -> Should skip handler execution
    await wrappedHandler(topic, payload, meta);
    expect(rawHandler).toHaveBeenCalledTimes(1);

    // Verify row inserted in `processed_events`
    const dbRes = await pool.query(
      `SELECT * FROM processed_events WHERE event_id = $1 AND consumer_group = $2`,
      [eventId, consumerGroup]
    );
    expect(dbRes.rows.length).toBe(1);
  });

  it('should rollback processed_events on handler failure and allow successful retry', async () => {
    const consumerGroup = 'test-retry-consumer-group';
    const eventId = `evt_fail_retry_${Date.now()}`;
    const topic = 'inventory.reserved';
    const payload = { sku: 'ITEM-TEST', quantity: 2 };
    const meta = { eventId };

    let attempts = 0;
    const failingHandler = jest.fn().mockImplementation(async () => {
      attempts++;
      if (attempts === 1) {
        throw new Error('Database Connection Temporary Spike Failure');
      }
      return undefined;
    });

    const wrappedHandler = wrapIdempotentConsumer({
      consumerGroup,
      handler: failingHandler
    });

    // 1. First attempt fails
    await expect(wrappedHandler(topic, payload, meta)).rejects.toThrow('Database Connection Temporary Spike Failure');

    // Verify processed_events is NOT marked
    const dbResAfterFail = await pool.query(
      `SELECT * FROM processed_events WHERE event_id = $1 AND consumer_group = $2`,
      [eventId, consumerGroup]
    );
    expect(dbResAfterFail.rows.length).toBe(0);

    // 2. Retry succeeds
    await wrappedHandler(topic, payload, meta);
    expect(failingHandler).toHaveBeenCalledTimes(2);

    // Verify processed_events is NOW marked
    const dbResAfterSuccess = await pool.query(
      `SELECT * FROM processed_events WHERE event_id = $1 AND consumer_group = $2`,
      [eventId, consumerGroup]
    );
    expect(dbResAfterSuccess.rows.length).toBe(1);
  });

});
