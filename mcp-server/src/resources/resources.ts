import { orderflowClient } from '../clients/orderflowClient.js';

export const MCP_RESOURCES_DEFINITIONS = [
  {
    uri: 'orderflow://architecture',
    name: 'OrderFlow System Architecture',
    description: 'Overview of distributed microservices, PostgreSQL outbox, Kafka event mesh, Saga orchestrator, and RabbitMQ topology.',
    mimeType: 'application/json'
  },
  {
    uri: 'orderflow://services',
    name: 'Microservice & Infrastructure Health Registry',
    description: 'Real-time connection status and metrics for PostgreSQL, Redis, Kafka, RabbitMQ, and API Gateway.',
    mimeType: 'application/json'
  },
  {
    uri: 'orderflow://kafka/topics',
    name: 'Kafka Topics & Partition Registry',
    description: 'Active event topics: OrderCreated, InventoryReserved, PaymentProcessed, PaymentFailed, OrdersConfirmed, OrdersCancelled.',
    mimeType: 'application/json'
  },
  {
    uri: 'orderflow://metrics',
    name: 'System RED Metrics Summary',
    description: 'Current throughput (RPS), P50/P95/P99 latency distribution, and error rates.',
    mimeType: 'application/json'
  },
  {
    uri: 'orderflow://dlq',
    name: 'Dead Letter Queue State',
    description: 'RabbitMQ notification_dlq message count and retry state.',
    mimeType: 'application/json'
  }
];

export async function handleReadResource(uri: string) {
  if (uri === 'orderflow://architecture') {
    return {
      architecture: 'Event-Driven Distributed Order Engine',
      database: 'PostgreSQL (ACID Source of Truth)',
      outbox: 'Transactional Outbox Pattern (FOR UPDATE SKIP LOCKED)',
      messaging: 'Apache Kafka (Event Streaming) + RabbitMQ (Async Notification DLQ)',
      saga: 'Orchestrated Saga Pattern with Compensating Inventory Rollback',
      caching: 'Redis Mutex Engine & Dual-Layer Idempotency'
    };
  }

  if (uri === 'orderflow://services') {
    return await orderflowClient.getServiceHealth();
  }

  if (uri === 'orderflow://kafka/topics') {
    return {
      cluster: 'localhost:9092',
      topics: [
        'OrderCreated',
        'InventoryReserved',
        'PaymentProcessed',
        'PaymentFailed',
        'OrdersConfirmed',
        'OrdersCancelled'
      ]
    };
  }

  if (uri === 'orderflow://metrics') {
    return await orderflowClient.getSystemMetrics();
  }

  if (uri === 'orderflow://dlq') {
    return await orderflowClient.getDlqMessages();
  }

  if (uri.startsWith('orderflow://saga/')) {
    const orderId = uri.replace('orderflow://saga/', '');
    return await orderflowClient.getSagaStatus(orderId);
  }

  throw new Error(`Resource not found: ${uri}`);
}
