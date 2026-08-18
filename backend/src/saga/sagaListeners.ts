import { kafkaConsumer } from '../kafka/consumer.js';
import { KAFKA_TOPICS } from '../kafka/topics.js';
import { rabbitMQProducer } from '../rabbitmq/producer.js';
import { sagaOrchestrator } from './sagaOrchestrator.js';

export function initializeSagaListeners() {
  console.log('⚡ Initializing Kafka Saga Event Listeners...');

  // 1. Listen for Orders Created -> Trigger Saga Step 1 (Inventory Reservation)
  kafkaConsumer.registerHandler(KAFKA_TOPICS.ORDERS_CREATED, async (topic, payload) => {
    console.log(`[Saga Listener] OrdersCreated event received for ${payload.orderId}. Triggering Saga Step 1...`);
    await sagaOrchestrator.handleOrderCreated(payload);
  });

  // 2. Listen for Inventory Reserved -> Trigger Saga Step 2 (Payment Processing)
  kafkaConsumer.registerHandler(KAFKA_TOPICS.INVENTORY_RESERVED, async (topic, payload) => {
    console.log(`[Saga Listener] InventoryReserved event received for ${payload.orderId}. Triggering Saga Step 2...`);
    await sagaOrchestrator.handleInventoryReserved(payload);
  });

  // 3. Listen for Orders Confirmed -> Queue Async Notification Job in RabbitMQ
  kafkaConsumer.registerHandler(KAFKA_TOPICS.ORDERS_CONFIRMED, async (topic, payload) => {
    console.log(`[Saga Listener] OrderConfirmed event received for ${payload.orderId}. Enqueuing RabbitMQ Notification task...`);
    
    await rabbitMQProducer.sendNotificationTask({
      orderId: payload.orderId,
      type: 'EMAIL',
      recipient: payload.customerEmail || 'alex.dev@example.com',
      template: 'ORDER_CONFIRMED_RECEIPT',
      data: {
        amount: payload.totalAmount,
        txnId: payload.txnId
      }
    });
  });

  // 4. Listen for Orders Cancelled -> Audit Log
  kafkaConsumer.registerHandler(KAFKA_TOPICS.ORDERS_CANCELLED, async (topic, payload) => {
    console.log(`[Saga Listener] OrderCancelled event received for ${payload.orderId}. Reason: ${payload.reason}`);
  });
}
