import { Router } from 'express';
import { orderService } from '../services/orderService.js';
import { inventoryService } from '../services/inventoryService.js';
import { register, ordersTotalCounter } from '../metrics/prometheus.js';
import { authRouter } from './auth.js';
import { pool } from '../config/db.js';
import { isRedisAvailable, redis } from '../redis/client.js';
import { idempotencyMiddleware } from '../middleware/idempotencyMiddleware.js';
import { kafkaProducer } from '../kafka/producer.js';
import { rabbitMQClient } from '../rabbitmq/client.js';
import { mcpRouter } from './mcpRouter.js';

export const apiRouter = Router();

apiRouter.use('/auth', authRouter);
apiRouter.use('/mcp', mcpRouter);

/**
 * GET /api/health - Unified health check with truthful runtime dependency status
 */
apiRouter.get('/health', async (req, res) => {
  let pgHealthy = false;
  try {
    await pool.query('SELECT 1');
    pgHealthy = true;
  } catch (err) {
    pgHealthy = false;
  }

  let redisHealthy = false;
  try {
    if (isRedisAvailable()) {
      await redis.ping();
      redisHealthy = true;
    }
  } catch (err) {
    redisHealthy = false;
  }

  const kafkaHealthy = kafkaProducer.isKafkaConnected();
  const rabbitmqHealthy = rabbitMQClient.getIsConnected();

  const status = pgHealthy ? 'HEALTHY' : 'DEGRADED';
  return res.status(pgHealthy ? 200 : 503).json({
    status,
    service: 'OrderFlow Distributed API Gateway',
    processUptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    dependencies: {
      database: pgHealthy ? 'UP' : 'DOWN',
      redis: redisHealthy ? 'UP' : 'UNAVAILABLE',
      kafka: kafkaHealthy ? 'UP' : 'UNAVAILABLE',
      rabbitmq: rabbitmqHealthy ? 'UP' : 'UNAVAILABLE'
    }
  });
});

/**
 * GET /api/health/live - Liveness Probe (Process level)
 */
apiRouter.get('/health/live', (req, res) => {
  return res.status(200).json({
    status: 'UP',
    processUptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

/**
 * GET /api/health/ready - Readiness Probe (Dependency level)
 */
apiRouter.get('/health/ready', async (req, res) => {
  let pgHealthy = false;
  try {
    await pool.query('SELECT 1');
    pgHealthy = true;
  } catch (err) {
    pgHealthy = false;
  }

  if (pgHealthy) {
    return res.status(200).json({
      status: 'READY',
      database: 'UP',
      processUptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString()
    });
  } else {
    return res.status(503).json({
      status: 'UNAVAILABLE',
      database: 'DOWN',
      processUptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString()
    });
  }
});

import { paymentService } from '../services/paymentService.js';

/**
 * GET /api/services/health - Detailed health check for all microservices & infra
 */
apiRouter.get('/services/health', async (req, res) => {
  const timestamp = new Date().toISOString();

  // 1. Real PostgreSQL Check
  let pgHealthy = false;
  let pgPoolUsed = 0;
  let pgLatency = 0;
  const pgStart = Date.now();
  try {
    await pool.query('SELECT 1');
    pgLatency = Date.now() - pgStart;
    pgHealthy = true;
    pgPoolUsed = pool.totalCount - pool.idleCount;
  } catch (err) {
    pgHealthy = false;
  }

  // 2. Real Redis Check
  let redisHealthy = false;
  let redisLatency = 0;
  const redisStart = Date.now();
  try {
    if (isRedisAvailable()) {
      await redis.ping();
      redisLatency = Date.now() - redisStart;
      redisHealthy = true;
    }
  } catch (err) {
    redisHealthy = false;
  }

  // 3. Real Kafka Check
  const kafkaHealthy = kafkaProducer.isKafkaConnected();

  // 4. Real RabbitMQ Check
  const rabbitmqHealthy = rabbitMQClient.getIsConnected();

  // Overall system status calculation:
  // HEALTHY: All core & broker dependencies functional
  // DEGRADED: PostgreSQL functional, but secondary brokers/caches disconnected
  // UNAVAILABLE: PostgreSQL database unreachable
  let overallStatus: 'HEALTHY' | 'DEGRADED' | 'UNAVAILABLE' = 'HEALTHY';
  if (!pgHealthy) {
    overallStatus = 'UNAVAILABLE';
  } else if (!redisHealthy || !kafkaHealthy || !rabbitmqHealthy) {
    overallStatus = 'DEGRADED';
  }

  const cbState = paymentService.circuitBreaker.getStatus();

  const services = [
    {
      id: 'order-service',
      name: 'Order Service',
      status: pgHealthy ? 'HEALTHY' : 'UNAVAILABLE',
      latencyMs: pgHealthy ? pgLatency : 0,
      mode: pgHealthy ? 'REAL' : 'UNAVAILABLE',
      lastChecked: 'Just now',
      details: {
        type: 'Microservice',
        endpoint: '/api/orders',
        protocol: 'HTTP / REST',
        framework: 'Express + Saga Orchestrator',
        dbConnection: pgHealthy ? 'CONNECTED' : 'DISCONNECTED'
      }
    },
    {
      id: 'inventory-service',
      name: 'Inventory Service',
      status: pgHealthy ? 'HEALTHY' : 'UNAVAILABLE',
      latencyMs: pgHealthy ? pgLatency : 0,
      mode: pgHealthy ? 'REAL' : 'UNAVAILABLE',
      lastChecked: 'Just now',
      details: {
        type: 'Microservice',
        endpoint: '/api/inventory',
        lockingStrategy: 'PostgreSQL FOR UPDATE / CAS Versioning',
        table: 'inventory'
      }
    },
    {
      id: 'payment-service',
      name: 'Payment Service',
      status: 'HEALTHY',
      latencyMs: 0,
      mode: 'REAL',
      lastChecked: 'Just now',
      details: {
        type: 'Microservice',
        circuitBreakerState: cbState,
        idempotency: 'Active (PostgreSQL + In-Memory Store)'
      }
    },
    {
      id: 'fulfillment-service',
      name: 'Fulfillment Service',
      status: pgHealthy ? 'HEALTHY' : 'UNAVAILABLE',
      latencyMs: 0,
      mode: pgHealthy ? 'REAL' : 'UNAVAILABLE',
      lastChecked: 'Just now',
      details: {
        type: 'Microservice',
        carrierIntegration: 'Transactional Outbox Pattern',
        queue: 'outbox_events'
      }
    },
    {
      id: 'notification-worker',
      name: 'Notification Worker',
      status: rabbitmqHealthy ? 'HEALTHY' : 'UNAVAILABLE',
      latencyMs: 0,
      mode: rabbitmqHealthy ? 'REAL' : 'UNAVAILABLE',
      lastChecked: 'Just now',
      details: {
        type: 'Worker Process',
        broker: 'RabbitMQ Consumer',
        queue: 'order_notifications'
      }
    },
    {
      id: 'kafka',
      name: 'Kafka Event Mesh',
      status: kafkaHealthy ? 'HEALTHY' : 'UNAVAILABLE',
      latencyMs: 0,
      mode: kafkaHealthy ? 'REAL' : 'UNAVAILABLE',
      lastChecked: 'Just now',
      details: {
        type: 'Event Streaming Broker',
        cluster: process.env.KAFKA_BROKERS || 'localhost:9092',
        topics: ['OrderCreated', 'InventoryReserved', 'PaymentProcessed', 'OrderFailed']
      }
    },
    {
      id: 'rabbitmq',
      name: 'RabbitMQ Broker',
      status: rabbitmqHealthy ? 'HEALTHY' : 'UNAVAILABLE',
      latencyMs: 0,
      mode: rabbitmqHealthy ? 'REAL' : 'UNAVAILABLE',
      lastChecked: 'Just now',
      details: {
        type: 'AMQP Message Broker',
        host: process.env.RABBITMQ_URL || 'amqp://localhost:5672'
      }
    },
    {
      id: 'redis',
      name: 'Redis Mutex Engine',
      status: redisHealthy ? 'HEALTHY' : 'UNAVAILABLE',
      latencyMs: redisHealthy ? redisLatency : 0,
      mode: redisHealthy ? 'REAL' : 'UNAVAILABLE',
      lastChecked: 'Just now',
      details: {
        type: 'In-Memory Cache & Mutex Lock Manager',
        host: process.env.REDIS_URL || 'redis://localhost:6379'
      }
    },
    {
      id: 'postgresql',
      name: 'PostgreSQL Database',
      status: pgHealthy ? 'HEALTHY' : 'UNAVAILABLE',
      latencyMs: pgHealthy ? pgLatency : 0,
      mode: pgHealthy ? 'REAL' : 'UNAVAILABLE',
      lastChecked: 'Just now',
      details: {
        type: 'Relational ACID Database',
        connection: pgHealthy ? 'Connected' : 'Disconnected',
        pool: `${pgPoolUsed} / ${(pool as any).options?.max || 20}`,
        latency: `${pgLatency} ms`,
        database: 'orderflow'
      }
    }
  ];

  return res.json({
    status: overallStatus,
    timestamp,
    processUptimeSeconds: Math.floor(process.uptime()),
    services
  });
});

/**
 * GET /metrics - Prometheus Metrics Scraping Endpoint
 */
apiRouter.get('/metrics', async (req, res) => {
  try {
    res.setHeader('Content-Type', register.contentType);
    const metrics = await register.metrics();
    res.send(metrics);
  } catch (err: any) {
    res.status(500).send(err.message);
  }
});

import { validateOrderPayload } from '../utils/orderValidator.js';

/**
 * POST /api/orders - Submit Order via Asynchronous Saga Workflow
 */
apiRouter.post('/orders', idempotencyMiddleware, async (req, res) => {
  try {
    const validation = validateOrderPayload(req.body);
    if (!validation.valid || !validation.data) {
      return res.status(validation.statusCode || 400).json({ error: validation.error });
    }

    const { sku, quantity, customerEmail, idempotencyKey, lockStrategy } = validation.data;

    const result = await orderService.createOrder({
      sku,
      quantity,
      customerEmail,
      idempotencyKey: idempotencyKey || `idemp_${Date.now()}`,
      lockStrategy
    });

    // Record Prometheus Order Counter
    ordersTotalCounter.inc({ status: result.status, lock_strategy: lockStrategy });

    return res.status(201).json(result);

  } catch (err: any) {
    const statusCode = err.statusCode || 500;
    const errorMessage = statusCode === 500 ? 'Internal Server Error' : err.message;
    return res.status(statusCode).json({ error: errorMessage });
  }
});

/**
 * GET /api/orders/:id - Query Order status and details
 */
apiRouter.get('/orders/:id', async (req, res) => {
  try {
    const order = await orderService.getOrder(req.params.id);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    return res.json(order);
  } catch (err: any) {
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

/**
 * GET /api/inventory/:sku - Query inventory stock
 */
apiRouter.get('/inventory/:sku', async (req, res) => {
  try {
    const stock = await inventoryService.getStock(req.params.sku);
    if (!stock) {
      return res.status(404).json({ error: 'SKU not found' });
    }
    return res.json(stock);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

import { verifyWebhookSignature } from '../middleware/webhookAuth.js';
import { sagaOrchestrator } from '../saga/sagaOrchestrator.js';

/**
 * POST /api/webhooks/payment - Production-Style Payment Gateway Webhook Endpoint
 * Authenticates signatures using HMAC SHA-256 and delegates event processing to Saga Engine
 * under atomic processed_events deduplication constraints.
 */
apiRouter.post('/webhooks/payment', verifyWebhookSignature, async (req, res) => {
  const { eventId, eventType, orderId, sku, quantity, error } = req.body;

  if (!eventId || !eventType || !orderId) {
    return res.status(400).json({ error: 'Malformed webhook payload: missing eventId, eventType, or orderId' });
  }

  const consumerGroup = 'payment-webhook-handler';

  try {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Deduplicate webhook delivery using UNIQUE(event_id, consumer_group) constraint
      const insertRes = await client.query(
        `INSERT INTO processed_events (event_id, consumer_group)
         VALUES ($1, $2)
         ON CONFLICT (event_id, consumer_group) DO NOTHING`,
        [eventId, consumerGroup]
      );

      if (insertRes.rowCount === 0) {
        await client.query('COMMIT');
        return res.status(200).json({ message: 'Duplicate webhook event safely ignored', eventId });
      }

      // Delegate event to Saga State Machine (enforces conditional status transition checks)
      if (eventType === 'payment.succeeded') {
        await sagaOrchestrator.transitionState(orderId, 'COMPLETED');
      } else if (eventType === 'payment.failed') {
        await sagaOrchestrator.handlePaymentFailed({
          orderId,
          sku: sku || 'UNKNOWN',
          quantity: quantity || 1,
          error: error || 'Payment failed via webhook callback'
        });
      }

      await client.query('COMMIT');
      return res.status(200).json({ status: 'SUCCESS', message: 'Webhook event processed', eventId });

    } catch (err: any) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err: any) {
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});
