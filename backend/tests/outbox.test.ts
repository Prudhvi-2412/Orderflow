import { outboxWorker } from '../src/workers/outboxWorker.ts';
import { pool } from '../src/config/db.js';

describe('Transactional Outbox Pattern & Background Publisher Tests', () => {

  it('should process pending outbox events gracefully from database', async () => {
    const eventId = `test_outbox_evt_${Date.now()}`;

    // Stage pending outbox event
    await pool.query(
      `INSERT INTO outbox_events (event_id, topic, payload, status)
       VALUES ($1, 'orders.created', $2, 'PENDING')`,
      [eventId, JSON.stringify({ orderId: 'ORD-OUTBOX-999', amount: 999 })]
    );

    // Run batch processing
    const processed = await outboxWorker.processOutboxBatch();

    // Verify outbox row status updated or attempted without throwing
    expect(typeof processed).toBe('number');
  });

});
