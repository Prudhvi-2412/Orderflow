import { outboxWorker } from '../src/workers/outboxWorker.js';
import { kafkaProducer } from '../src/kafka/producer.js';
import { wrapIdempotentConsumer } from '../src/kafka/idempotentConsumer.js';
import { pool } from '../src/config/db.js';
import { closeRedisConnection } from '../src/redis/client.js';

describe('Transactional Outbox Worker Concurrency & Resilience Test Suite', () => {

  const testPrefix = `outbox_test_${Date.now()}`;

  afterAll(async () => {
    await closeRedisConnection();
    await pool.end();
  });

  it('1-2. Pending outbox event is claimed, published, and marked PUBLISHED', async () => {
    const eventId = `${testPrefix}_evt_1`;
    await pool.query(
      `INSERT INTO outbox_events (event_id, topic, payload, status)
       VALUES ($1, 'orders.created', $2, 'PENDING')`,
      [eventId, JSON.stringify({ orderId: 'ORD-TEST-1', sku: 'ITEM-1', quantity: 1 })]
    );

    const published = await outboxWorker.processOutboxBatch();
    expect(published).toBeGreaterThanOrEqual(1);

    const row = await pool.query(`SELECT status, processed_at FROM outbox_events WHERE event_id = $1`, [eventId]);
    expect(row.rows[0].status).toBe('PUBLISHED');
    expect(row.rows[0].processed_at).not.toBeNull();
  });

  it('3-4. Kafka failure leaves event PENDING with incremented attempts & backoff timestamp', async () => {
    const eventId = `${testPrefix}_evt_fail`;
    await pool.query(
      `INSERT INTO outbox_events (event_id, topic, payload, status)
       VALUES ($1, 'orders.created', $2, 'PENDING')`,
      [eventId, JSON.stringify({ orderId: 'ORD-FAIL-1' })]
    );

    // Mock Kafka publish failure
    const publishSpy = jest.spyOn(kafkaProducer, 'publish').mockResolvedValueOnce(false);

    await outboxWorker.processOutboxBatch();

    const row = await pool.query(`SELECT status, attempts, error, next_retry_at FROM outbox_events WHERE event_id = $1`, [eventId]);
    expect(row.rows[0].status).toBe('PENDING');
    expect(row.rows[0].attempts).toBe(1);
    expect(row.rows[0].error).toBeDefined();
    expect(row.rows[0].next_retry_at).not.toBeNull();

    publishSpy.mockRestore();
  });

  it('5-6. FOR UPDATE SKIP LOCKED prevents multiple workers from claiming the same event', async () => {
    const eventId1 = `${testPrefix}_skip_1`;
    const eventId2 = `${testPrefix}_skip_2`;

    await pool.query(
      `INSERT INTO outbox_events (event_id, topic, payload, status) VALUES 
       ($1, 'orders.created', '{"orderId":"O1"}', 'PENDING'),
       ($2, 'orders.created', '{"orderId":"O2"}', 'PENDING')`,
      [eventId1, eventId2]
    );

    // Run 2 worker process calls concurrently
    const [p1, p2] = await Promise.all([
      outboxWorker.processOutboxBatch(),
      outboxWorker.processOutboxBatch()
    ]);

    // Total published across both concurrent workers equals total pending events (2)
    expect(p1 + p2).toBe(2);
  });

  it('7. Worker crash lease timeout (stuck PROCESSING > 30s) allows event recovery & re-claiming', async () => {
    const eventId = `${testPrefix}_crash_lease`;

    // Insert an event stuck in 'PROCESSING' for 40 seconds
    await pool.query(
      `INSERT INTO outbox_events (event_id, topic, payload, status, processing_started_at)
       VALUES ($1, 'orders.created', '{"orderId":"O-CRASH"}', 'PROCESSING', NOW() - INTERVAL '40 seconds')`,
      [eventId]
    );

    const count = await outboxWorker.processOutboxBatch();
    expect(count).toBeGreaterThanOrEqual(1);

    const row = await pool.query(`SELECT status FROM outbox_events WHERE event_id = $1`, [eventId]);
    expect(row.rows[0].status).toBe('PUBLISHED');
  });

  it('8-9. Stable event_id is preserved across retries (At-Least-Once Delivery)', async () => {
    const eventId = `${testPrefix}_stable_id`;

    await pool.query(
      `INSERT INTO outbox_events (event_id, topic, payload, status)
       VALUES ($1, 'orders.created', $2, 'PENDING')`,
      [eventId, JSON.stringify({ orderId: 'ORD-STABLE-1' })]
    );

    const publishSpy = jest.spyOn(kafkaProducer, 'publish');

    await outboxWorker.processOutboxBatch();

    // Verify publish was called with the exact stable eventId
    expect(publishSpy).toHaveBeenCalledWith(
      'orders.created',
      'ORD-STABLE-1',
      expect.anything(),
      expect.objectContaining({ eventId })
    );

    publishSpy.mockRestore();
  });

  it('10. Duplicate Kafka delivery is safely deduplicated by consumer wrapper', async () => {
    const eventId = `${testPrefix}_dup_consumer`;
    const consumerGroup = 'outbox-test-group';

    const handlerMock = jest.fn().mockResolvedValue(undefined);
    const consumer = wrapIdempotentConsumer({ consumerGroup, handler: handlerMock });

    // 1st delivery
    await consumer('orders.created', { orderId: 'ORD-DUP' }, { eventId });
    expect(handlerMock).toHaveBeenCalledTimes(1);

    // 2nd (duplicate) delivery
    await consumer('orders.created', { orderId: 'ORD-DUP' }, { eventId });
    expect(handlerMock).toHaveBeenCalledTimes(1); // Second delivery skipped safely!
  });

});
