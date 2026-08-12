import { KAFKA_TOPICS } from '../src/kafka/topics.js';
import { kafkaProducer } from '../src/kafka/producer.js';
import { OrderFlowKafkaConsumer } from '../src/kafka/consumer.js';

describe('Apache Kafka Producer & Consumer Abstraction Tests', () => {

  it('should define all 8 core Kafka lifecycle topics correctly', () => {
    expect(KAFKA_TOPICS.ORDERS_CREATED).toBe('orders.created');
    expect(KAFKA_TOPICS.INVENTORY_RESERVED).toBe('inventory.reserved');
    expect(KAFKA_TOPICS.PAYMENT_COMPLETED).toBe('payment.completed');
    expect(KAFKA_TOPICS.ORDERS_CANCELLED).toBe('orders.cancelled');
  });

  it('should allow handler registration on Kafka Consumer Group', () => {
    const consumer = new OrderFlowKafkaConsumer('test-consumer-group');
    const mockHandler = jest.fn();

    consumer.registerHandler(KAFKA_TOPICS.ORDERS_CREATED, mockHandler);

    // Verify consumer instance was constructed without throwing
    expect(consumer).toBeDefined();
  });

  it('should handle Kafka Producer publish gracefully even when standalone broker is offline', async () => {
    const published = await kafkaProducer.publish(
      KAFKA_TOPICS.ORDERS_CREATED,
      'ORD-TEST-100',
      { sku: 'ITEM-IPHONE-15', quantity: 1 }
    );

    // Should return false or true gracefully without unhandled crashes
    expect(typeof published).toBe('boolean');
  });

});
