import { RABBITMQ_EXCHANGES, RABBITMQ_QUEUES, RABBITMQ_ROUTING_KEYS, rabbitMQClient } from '../src/rabbitmq/client.js';
import { rabbitMQProducer } from '../src/rabbitmq/producer.js';

describe('RabbitMQ Task Queue & Dead Letter Queue (DLQ) Topology Tests', () => {

  afterAll(async () => {
    await rabbitMQClient.close();
  });

  it('should verify core RabbitMQ topology names and Dead Letter Exchange configurations', () => {
    expect(RABBITMQ_EXCHANGES.ORDERS).toBe('orders_exchange');
    expect(RABBITMQ_EXCHANGES.DLX).toBe('notification_dlx');
    expect(RABBITMQ_QUEUES.NOTIFICATION).toBe('notification_queue');
    expect(RABBITMQ_QUEUES.NOTIFICATION_DLQ).toBe('notification_dlq');
    expect(RABBITMQ_ROUTING_KEYS.NOTIFICATION_SEND).toBe('notification.send');
  });

  it('should handle notification task publishing gracefully when standalone broker is offline', async () => {
    const published = await rabbitMQProducer.sendNotificationTask({
      orderId: 'ORD-TEST-999',
      type: 'EMAIL',
      recipient: 'alex.dev@example.com',
      template: 'ORDER_CONFIRMATION',
      data: { totalAmount: 999.00 }
    });

    // Returns boolean without throwing unhandled exceptions
    expect(typeof published).toBe('boolean');
  });

});
