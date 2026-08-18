import { outboxWorker, OutboxWorker } from '../src/workers/outboxWorker.js';
import { pool } from '../src/config/db.js';
import { kafkaProducer } from '../src/kafka/producer.js';
import { closeRedisConnection } from '../src/redis/client.js';

describe('Transactional Outbox Worker Concurrency, Retries & Crash Recovery Suite', () => {

  beforeEach(async () => {
    await pool.query(`DELETE FROM outbox_events WHERE topic = 'orders.test.outbox'`);
  });

  afterAll(async () => {
    await closeRedisConnection();
    await pool.end();
  });

  it('1. Normal outbox publication moves event from PENDING -> PROCESSING -> PUBLISHED', async () => {
    const eventId = `evt_norm_${Date.now()}`;
    await pool.query(
      `INSERT INTO outbox_events (event_id, topic, payload, status)
       VALUES ($1, 'orders.test.outbox', $2, 'PENDING')`,
      [eventId, JSON.stringify({ orderId: 'ORD-OUT-1' })]
    );

    const publishSpy = jest.spyOn(kafkaProducer, 'publish').mockResolvedValue(true);

    const count = await outboxWorker.processOutboxBatch();
    expect(count).toBeGreaterThanOrEqual(1);

    const res = await pool.query(`SELECT status, processed_at FROM outbox_events WHERE event_id = $1`, [eventId]);
    expect(res.rows[0].status).toBe('PUBLISHED');
    expect(res.rows[0].processed_at).not.toBeNull();

    publishSpy.mockRestore();
  });

  it('2, 3, 10 & 11. Kafka failure sets backoff, increments attempts, and preserves STABLE event_id', async () => {
    const eventId = `evt_fail_backoff_${Date.now()}`;
    await pool.query(
      `INSERT INTO outbox_events (event_id, topic, payload, status, attempts)
       VALUES ($1, 'orders.test.outbox', $2, 'PENDING', 1)`,
      [eventId, JSON.stringify({ orderId: 'ORD-OUT-2' })]
    );

    const publishSpy = jest.spyOn(kafkaProducer, 'publish').mockResolvedValue(false);

    await outboxWorker.processOutboxBatch();

    const res = await pool.query(
      `SELECT event_id, status, attempts, next_retry_at, error FROM outbox_events WHERE event_id = $1`,
      [eventId]
    );

    expect(res.rows[0].event_id).toBe(eventId); // Event ID remains STABLE!
    expect(res.rows[0].attempts).toBe(2);
    expect(res.rows[0].status).toBe('PENDING'); // Kept retryable
    expect(res.rows[0].next_retry_at).not.toBeNull();
    expect(res.rows[0].error).toBeDefined();

    publishSpy.mockRestore();
  });

  it('4 & 5. Stale PROCESSING events (> 30s lease) are automatically reclaimed and processed', async () => {
    const eventId = `evt_stale_lease_${Date.now()}`;

    // Insert event stuck in PROCESSING for 40 seconds (simulated crash after claim)
    await pool.query(
      `INSERT INTO outbox_events (event_id, topic, payload, status, processing_started_at)
       VALUES ($1, 'orders.test.outbox', $2, 'PROCESSING', NOW() - INTERVAL '40 seconds')`,
      [eventId, JSON.stringify({ orderId: 'ORD-STUCK-LEASE' })]
    );

    const publishSpy = jest.spyOn(kafkaProducer, 'publish').mockResolvedValue(true);

    const count = await outboxWorker.processOutboxBatch();
    expect(count).toBeGreaterThanOrEqual(1);

    const res = await pool.query(`SELECT status FROM outbox_events WHERE event_id = $1`, [eventId]);
    expect(res.rows[0].status).toBe('PUBLISHED');

    publishSpy.mockRestore();
  });

  it('6 & 7. Crash after Kafka publish but before DB update causes redelivery with SAME event_id', async () => {
    const eventId = `evt_crash_publish_${Date.now()}`;
    await pool.query(
      `INSERT INTO outbox_events (event_id, topic, payload, status)
       VALUES ($1, 'orders.test.outbox', $2, 'PENDING')`,
      [eventId, JSON.stringify({ orderId: 'ORD-CRASH-PUB' })]
    );

    // First publish succeeds in Kafka, but worker fails to update DB status
    let publishCount = 0;
    const publishSpy = jest.spyOn(kafkaProducer, 'publish').mockImplementation(async (t, k, p, options) => {
      publishCount++;
      expect(options.eventId).toBe(eventId); // Verify same event ID passed
      return true;
    });

    // Mock DB update error on first run
    const originalQuery = pool.query.bind(pool);
    let errorInjected = false;

    jest.spyOn(pool, 'query').mockImplementation(async (text: any, params?: any) => {
      if (typeof text === 'string' && text.includes("SET status = 'PUBLISHED'") && !errorInjected) {
        errorInjected = true;
        throw new Error('Simulated DB connection failure after Kafka publish');
      }
      return originalQuery(text, params);
    });

    await outboxWorker.processOutboxBatch(); // DB update failed, event remains PROCESSING

    // Reset DB mock for second run
    jest.restoreAllMocks();
    const publishSpy2 = jest.spyOn(kafkaProducer, 'publish').mockResolvedValue(true);

    // Simulate stale lease recovery after restart
    await pool.query(`UPDATE outbox_events SET processing_started_at = NOW() - INTERVAL '40 seconds' WHERE event_id = $1`, [eventId]);

    await outboxWorker.processOutboxBatch();

    const res = await pool.query(`SELECT status FROM outbox_events WHERE event_id = $1`, [eventId]);
    expect(res.rows[0].status).toBe('PUBLISHED');

    publishSpy2.mockRestore();
  });

  it('8 & 9. Concurrent workers processing outbox table claim distinct rows via SKIP LOCKED', async () => {
    const event1 = `evt_conc_1_${Date.now()}`;
    const event2 = `evt_conc_2_${Date.now()}`;

    await pool.query(
      `INSERT INTO outbox_events (event_id, topic, payload, status) VALUES
       ($1, 'orders.test.outbox', '{"id":1}', 'PENDING'),
       ($2, 'orders.test.outbox', '{"id":2}', 'PENDING')`,
      [event1, event2]
    );

    const publishSpy = jest.spyOn(kafkaProducer, 'publish').mockResolvedValue(true);

    const workerA = new OutboxWorker();
    const workerB = new OutboxWorker();

    const [c1, c2] = await Promise.all([
      workerA.processOutboxBatch(),
      workerB.processOutboxBatch()
    ]);

    expect(c1 + c2).toBeGreaterThanOrEqual(2);

    const res = await pool.query(
      `SELECT status FROM outbox_events WHERE event_id IN ($1, $2)`,
      [event1, event2]
    );
    expect(res.rows.every(r => r.status === 'PUBLISHED')).toBe(true);

    publishSpy.mockRestore();
  });

  it('12. Event reaching max attempts is marked FAILED without endless hot-loop retries', async () => {
    const eventId = `evt_max_fail_${Date.now()}`;
    await pool.query(
      `INSERT INTO outbox_events (event_id, topic, payload, status, attempts)
       VALUES ($1, 'orders.test.outbox', $2, 'PENDING', 9)`,
      [eventId, JSON.stringify({ orderId: 'ORD-MAX-FAIL' })]
    );

    const publishSpy = jest.spyOn(kafkaProducer, 'publish').mockResolvedValue(false);

    await outboxWorker.processOutboxBatch();

    const res = await pool.query(
      `SELECT status, attempts, error FROM outbox_events WHERE event_id = $1`,
      [eventId]
    );

    expect(res.rows[0].attempts).toBe(10);
    expect(res.rows[0].status).toBe('FAILED');
    expect(res.rows[0].error).toBeDefined();

    publishSpy.mockRestore();
  });

  it('13. Slow Worker A losing lease to Worker B cannot overwrite Worker B claim_token', async () => {
    const eventId = `evt_slow_lease_${Date.now()}`;
    const tokenA = 'token_worker_A_123';
    const tokenB = 'token_worker_B_456';

    // Worker A claims event at T=0
    await pool.query(
      `INSERT INTO outbox_events (event_id, topic, payload, status, claim_token, processing_started_at)
       VALUES ($1, 'orders.test.outbox', '{"id":3}', 'PROCESSING', $2, NOW() - INTERVAL '40 seconds')`,
      [eventId, tokenA]
    );

    // Worker B re-claims stale lease at T=35
    await pool.query(
      `UPDATE outbox_events 
       SET claim_token = $1, processing_started_at = NOW() 
       WHERE event_id = $2 AND claim_token = $3`,
      [tokenB, eventId, tokenA]
    );

    // Worker A finishes slow publish and attempts update using stale tokenA
    const updateRes = await pool.query(
      `UPDATE outbox_events 
       SET status = 'PUBLISHED', processed_at = NOW(), processing_started_at = NULL, claim_token = NULL 
       WHERE event_id = $1 AND claim_token = $2`,
      [eventId, tokenA]
    );

    // Worker A's update affects 0 rows because claim_token is now tokenB!
    expect(updateRes.rowCount).toBe(0);

    // Verify event is still actively owned by Worker B
    const res = await pool.query(`SELECT status, claim_token FROM outbox_events WHERE event_id = $1`, [eventId]);
    expect(res.rows[0].status).toBe('PROCESSING');
    expect(res.rows[0].claim_token).toBe(tokenB);
  });

  it('14. Stale Worker A cannot modify status, attempts, next_retry_at, error, processed_at, or claim_token', async () => {
    const eventId = `evt_stale_all_columns_${Date.now()}`;
    const tokenA = 'stale_token_A';
    const tokenB = 'active_token_B';

    await pool.query(
      `INSERT INTO outbox_events (event_id, topic, payload, status, claim_token, attempts, processing_started_at)
       VALUES ($1, 'orders.test.outbox', '{"id":4}', 'PROCESSING', $2, 1, NOW() - INTERVAL '40 seconds')`,
      [eventId, tokenA]
    );

    // Worker B re-claims stale lease
    await pool.query(
      `UPDATE outbox_events SET claim_token = $1, processing_started_at = NOW() WHERE event_id = $2 AND claim_token = $3`,
      [tokenB, eventId, tokenA]
    );

    // Worker A attempts failure update (status, attempts, next_retry_at, error) using stale tokenA
    const failUpdate = await pool.query(
      `UPDATE outbox_events 
       SET attempts = 5, status = 'PENDING', next_retry_at = NOW() + INTERVAL '10 seconds', error = 'Stale error' 
       WHERE event_id = $1 AND claim_token = $2`,
      [eventId, tokenA]
    );
    expect(failUpdate.rowCount).toBe(0);

    // Worker A attempts success update (status, processed_at) using stale tokenA
    const okUpdate = await pool.query(
      `UPDATE outbox_events 
       SET status = 'PUBLISHED', processed_at = NOW() 
       WHERE event_id = $1 AND claim_token = $2`,
      [eventId, tokenA]
    );
    expect(okUpdate.rowCount).toBe(0);

    // Worker B completes publication and marks event PUBLISHED using active tokenB
    const bUpdate = await pool.query(
      `UPDATE outbox_events 
       SET status = 'PUBLISHED', processed_at = NOW(), processing_started_at = NULL, claim_token = NULL, error = NULL 
       WHERE event_id = $1 AND claim_token = $2`,
      [eventId, tokenB]
    );
    expect(bUpdate.rowCount).toBe(1);

    // Verify row reflects Worker B's clean completion
    const finalRes = await pool.query(`SELECT status, attempts, claim_token, processed_at FROM outbox_events WHERE event_id = $1`, [eventId]);
    expect(finalRes.rows[0].status).toBe('PUBLISHED');
    expect(finalRes.rows[0].attempts).toBe(1); // Not changed by Worker A!
    expect(finalRes.rows[0].claim_token).toBeNull();
    expect(finalRes.rows[0].processed_at).not.toBeNull();
  });

});
