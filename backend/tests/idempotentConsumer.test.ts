import { wrapIdempotentConsumer } from '../src/kafka/idempotentConsumer.js';
import { pool } from '../src/config/db.js';
import { closeRedisConnection } from '../src/redis/client.js';

describe('Processed Events Idempotent Consumer Concurrency Audit Suite', () => {

  const consumerGroup = 'audit-test-group';

  afterAll(async () => {
    await closeRedisConnection();
    await pool.end();
  });

  it('1-2. Database UNIQUE constraint & FOR UPDATE lock prevent concurrent duplicate execution', async () => {
    const eventId = `evt_audit_concurrent_${Date.now()}`;
    const mockHandler = jest.fn().mockImplementation(async (topic, payload, meta, client) => {
      // Simulate business DB operation inside transaction
      await client.query(`SELECT 1`);
    });

    const consumer = wrapIdempotentConsumer({ consumerGroup, handler: mockHandler });

    // Simulate two concurrent Kafka partition consumers receiving the exact same event
    await Promise.all([
      consumer('orders.created', { orderId: 'ORD-AUDIT-1' }, { eventId }),
      consumer('orders.created', { orderId: 'ORD-AUDIT-1' }, { eventId })
    ]);

    // Handler must execute EXACTLY ONCE
    expect(mockHandler).toHaveBeenCalledTimes(1);

    // Exactly 1 row inserted into processed_events
    const res = await pool.query(
      `SELECT count(*) FROM processed_events WHERE event_id = $1 AND consumer_group = $2`,
      [eventId, consumerGroup]
    );
    expect(parseInt(res.rows[0].count)).toBe(1);
  });

  it('3. Duplicate event delivered after successful DB commit is a NO-OP', async () => {
    const eventId = `evt_audit_noop_${Date.now()}`;
    const mockHandler = jest.fn().mockResolvedValue(undefined);
    const consumer = wrapIdempotentConsumer({ consumerGroup, handler: mockHandler });

    // First delivery (commits business change + processed_events)
    await consumer('orders.created', { orderId: 'ORD-AUDIT-2' }, { eventId });
    expect(mockHandler).toHaveBeenCalledTimes(1);

    // Redelivery after offset commit failure
    await consumer('orders.created', { orderId: 'ORD-AUDIT-2' }, { eventId });
    expect(mockHandler).toHaveBeenCalledTimes(1); // Handler NOT called again!
  });

  it('4. Crash/Error before DB commit rolls back both business change and processed_events record', async () => {
    const eventId = `evt_audit_rollback_${Date.now()}`;
    const failingHandler = jest.fn().mockImplementation(async () => {
      throw new Error('Database transaction crash simulation');
    });

    const consumer = wrapIdempotentConsumer({ consumerGroup, handler: failingHandler });

    await expect(consumer('orders.created', { orderId: 'ORD-FAIL' }, { eventId })).rejects.toThrow('Database transaction crash simulation');

    // Verify processed_events record was rolled back
    const res = await pool.query(
      `SELECT count(*) FROM processed_events WHERE event_id = $1 AND consumer_group = $2`,
      [eventId, consumerGroup]
    );
    expect(parseInt(res.rows[0].count)).toBe(0);
  });

});
