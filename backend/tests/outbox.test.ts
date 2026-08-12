import { outboxWorker } from '../src/workers/outboxWorker.js';
import { pool } from '../src/config/db.js';
import { kafkaProducer } from '../src/kafka/producer.js';

describe('Transactional Outbox Pattern & At-Least-Once Delivery Tests', () => {

  it('should process pending outbox events transactionally and set status to PUBLISHED', async () => {
    const eventId = `test_outbox_evt_${Date.now()}`;

    // Stage pending outbox event inside DB
    await pool.query(
      `INSERT INTO outbox_events (event_id, topic, payload, status)
       VALUES ($1, 'OrderCreated', $2, 'PENDING')`,
      [eventId, JSON.stringify({ orderId: 'ORD-OUTBOX-100', totalAmount: 499 })]
    );

    // Mock Kafka Producer success
    const publishSpy = jest.spyOn(kafkaProducer, 'publish').mockResolvedValue(true);

    const processedCount = await outboxWorker.processOutboxBatch();
    expect(processedCount).toBeGreaterThanOrEqual(1);

    // Verify outbox event transition to PUBLISHED
    const dbRes = await pool.query(
      `SELECT status, processed_at FROM outbox_events WHERE event_id = $1`,
      [eventId]
    );
    expect(dbRes.rows[0].status).toBe('PUBLISHED');
    expect(dbRes.rows[0].processed_at).not.toBeNull();

    publishSpy.mockRestore();
  });

  it('should increment attempts on publication failure and mark FAILED after limit', async () => {
    const eventId = `test_outbox_fail_${Date.now()}`;

    await pool.query(
      `INSERT INTO outbox_events (event_id, topic, payload, status, attempts)
       VALUES ($1, 'OrderCreated', $2, 'PENDING', 4)`,
      [eventId, JSON.stringify({ orderId: 'ORD-OUTBOX-FAIL', totalAmount: 100 })]
    );

    // Mock Kafka Producer failure
    const publishSpy = jest.spyOn(kafkaProducer, 'publish').mockResolvedValue(false);

    await outboxWorker.processOutboxBatch();

    const dbRes = await pool.query(
      `SELECT status, attempts, error FROM outbox_events WHERE event_id = $1`,
      [eventId]
    );
    expect(dbRes.rows[0].attempts).toBe(5);
    expect(dbRes.rows[0].status).toBe('FAILED');
    expect(dbRes.rows[0].error).toContain('Kafka Publish Failure');

    publishSpy.mockRestore();
  });

  it('should handle simulated worker crash cleanly and allow retry on restart', async () => {
    const eventId = `test_outbox_crash_${Date.now()}`;

    await pool.query(
      `INSERT INTO outbox_events (event_id, topic, payload, status)
       VALUES ($1, 'OrderCreated', $2, 'PENDING')`,
      [eventId, JSON.stringify({ orderId: 'ORD-OUTBOX-CRASH' })]
    );

    // Simulate worker 1 acquiring client and crashing before commit
    const client1 = await pool.connect();
    await client1.query('BEGIN');
    await client1.query(
      `SELECT id FROM outbox_events WHERE event_id = $1 FOR UPDATE`,
      [eventId]
    );
    // Worker 1 crashes -> releases connection (ROLLBACK)
    await client1.query('ROLLBACK');
    client1.release();

    // Worker 2 starts after restart and processes the event successfully
    const publishSpy = jest.spyOn(kafkaProducer, 'publish').mockResolvedValue(true);

    await outboxWorker.processOutboxBatch();

    const dbRes = await pool.query(
      `SELECT status FROM outbox_events WHERE event_id = $1`,
      [eventId]
    );
    expect(dbRes.rows[0].status).toBe('PUBLISHED');

    publishSpy.mockRestore();
  });

});
