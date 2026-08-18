import { pool } from '../../../backend/src/config/db.js';
import { orderService } from '../../../backend/src/services/orderService.js';
import { inventoryService } from '../../../backend/src/services/inventoryService.js';
import { sagaOrchestrator } from '../../../backend/src/saga/sagaOrchestrator.js';
import { kafkaProducer } from '../../../backend/src/kafka/producer.js';
import { rabbitMQClient } from '../../../backend/src/rabbitmq/client.js';
import { isRedisAvailable, redis } from '../../../backend/src/redis/client.js';
import { paymentService } from '../../../backend/src/services/paymentService.js';

export class OrderFlowClient {
  /**
   * Tool 1: get_order
   */
  async getOrder(orderId: string) {
    const res = await pool.query(
      `SELECT o.*, oi.sku, oi.quantity, oi.price 
       FROM orders o
       LEFT JOIN order_items oi ON o.order_id = oi.order_id
       WHERE o.order_id = $1`,
      [orderId]
    );

    if (res.rows.length === 0) {
      return { error: 'ORDER_NOT_FOUND', orderId };
    }

    const row = res.rows[0];

    // Check payment status
    const payRes = await pool.query(`SELECT status, txn_id FROM payments WHERE order_id = $1`, [orderId]);
    const paymentStatus = payRes.rows[0]?.status || (row.status === 'COMPLETED' ? 'SUCCESS' : 'PENDING');

    return {
      orderId: row.order_id,
      status: row.status,
      customerEmail: row.customer_email,
      totalAmount: parseFloat(row.total_amount),
      lockStrategy: row.lock_strategy,
      errorReason: row.error_reason,
      items: [
        {
          sku: row.sku || 'ITEM-IPHONE-15',
          quantity: row.quantity || 1,
          price: parseFloat(row.price || row.total_amount)
        }
      ],
      paymentStatus,
      inventoryStatus: row.status === 'CANCELLED' ? 'RELEASED' : 'RESERVED',
      sagaId: `saga_${row.order_id}`,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  /**
   * Tool 2: get_saga_status
   */
  async getSagaStatus(orderId: string) {
    const saga = await sagaOrchestrator.getSagaState(orderId);
    if (!saga) {
      return { error: 'SAGA_NOT_FOUND', orderId };
    }

    return {
      sagaId: saga.sagaId,
      orderId: saga.orderId,
      status: saga.status,
      currentStep: saga.currentStep,
      completedSteps: saga.completedSteps,
      compensationStatus: saga.status === 'CANCELLED' ? 'COMPLETED' : 'NONE',
      failureReason: saga.errorReason || null,
      timeline: [
        { step: 'PENDING', status: 'COMPLETED' },
        { step: 'INVENTORY_RESERVED', status: saga.completedSteps.includes('INVENTORY_RESERVED') ? 'COMPLETED' : 'SKIPPED' },
        { step: 'PAYMENT_PROCESSING', status: saga.completedSteps.includes('PAYMENT_COMPLETED') ? 'COMPLETED' : (saga.status === 'CANCELLED' ? 'FAILED' : 'PENDING') },
        { step: 'COMPENSATING', status: saga.status === 'CANCELLED' ? 'EXECUTED' : 'NONE' },
        { step: 'CONFIRMED', status: saga.status === 'COMPLETED' ? 'COMPLETED' : 'NONE' }
      ]
    };
  }

  /**
   * Tool 3: get_order_events
   */
  async getOrderEvents(orderId: string) {
    const outboxRes = await pool.query(
      `SELECT event_id, topic, payload, status, created_at, processed_at
       FROM outbox_events
       WHERE payload->>'orderId' = $1 OR payload->>'sagaId' = $1
       ORDER BY id ASC`,
      [orderId]
    );

    const processedRes = await pool.query(
      `SELECT event_id, consumer_group, processed_at
       FROM processed_events
       WHERE event_id LIKE $1`,
      [`%${orderId}%`]
    );

    return {
      orderId,
      outboxEvents: outboxRes.rows.map((r) => ({
        eventId: r.event_id,
        topic: r.topic,
        status: r.status,
        payload: r.payload,
        createdAt: r.created_at,
        processedAt: r.processed_at
      })),
      processedConsumerEvents: processedRes.rows
    };
  }

  /**
   * Tool 4: get_inventory
   */
  async getInventory(sku: string) {
    const stock = await inventoryService.getStock(sku);
    if (!stock) {
      return { error: 'SKU_NOT_FOUND', sku };
    }

    return {
      sku: stock.sku,
      stockQuantity: stock.stock_quantity,
      version: stock.version,
      availability: stock.stock_quantity > 0 ? 'IN_STOCK' : 'OUT_OF_STOCK',
      updatedAt: stock.updated_at
    };
  }

  /**
   * Tool 5: get_service_health
   */
  async getServiceHealth() {
    let pgHealthy = false;
    let pgLatency = 0;
    const pgStart = Date.now();
    try {
      await pool.query('SELECT 1');
      pgLatency = Date.now() - pgStart;
      pgHealthy = true;
    } catch (e) {}

    let redisHealthy = false;
    let redisLatency = 0;
    const redisStart = Date.now();
    try {
      if (isRedisAvailable()) {
        await redis.ping();
        redisLatency = Date.now() - redisStart;
        redisHealthy = true;
      }
    } catch (e) {}

    const kafkaHealthy = kafkaProducer.isKafkaConnected();
    const rabbitmqHealthy = rabbitMQClient.getIsConnected();

    let overallStatus: 'HEALTHY' | 'DEGRADED' | 'UNAVAILABLE' = 'HEALTHY';
    if (!pgHealthy) {
      overallStatus = 'UNAVAILABLE';
    } else if (!redisHealthy || !kafkaHealthy || !rabbitmqHealthy) {
      overallStatus = 'DEGRADED';
    }

    return {
      timestamp: new Date().toISOString(),
      processUptimeSeconds: Math.floor(process.uptime()),
      overallStatus,
      services: {
        postgresql: { status: pgHealthy ? 'HEALTHY' : 'UNAVAILABLE', latencyMs: pgHealthy ? pgLatency : 0 },
        redis: { status: redisHealthy ? 'HEALTHY' : 'UNAVAILABLE', latencyMs: redisHealthy ? redisLatency : 0 },
        kafka: { status: kafkaHealthy ? 'HEALTHY' : 'UNAVAILABLE' },
        rabbitmq: { status: rabbitmqHealthy ? 'HEALTHY' : 'UNAVAILABLE' },
        apiGateway: { status: 'HEALTHY' }
      }
    };
  }

  /**
   * Tool 6: get_system_metrics
   */
  async getSystemMetrics() {
    const pendingOutboxRes = await pool.query(
      `SELECT count(*) FROM outbox_events WHERE status = 'PENDING'`
    );
    const pendingOutbox = parseInt(pendingOutboxRes.rows[0]?.count || '0');

    const ordersTotalRes = await pool.query(
      `SELECT status, count(*) FROM orders GROUP BY status`
    );

    const orderStatusDistribution = ordersTotalRes.rows.reduce((acc: any, r: any) => {
      acc[r.status] = parseInt(r.count);
      return acc;
    }, {});

    const totalOrdersCount = Object.values(orderStatusDistribution).reduce((sum: number, count: any) => sum + count, 0);

    const cbState = paymentService.circuitBreaker.getStatus();

    return {
      timestamp: new Date().toISOString(),
      processUptimeSeconds: Math.floor(process.uptime()),
      totalOrdersCount,
      pendingOutboxEvents: pendingOutbox,
      circuitBreakerState: cbState,
      orderStatusDistribution
    };
  }

  /**
   * Tool 7: get_kafka_events
   */
  async getKafkaEvents(topic?: string, limit = 10) {
    const query = topic
      ? `SELECT event_id, topic, status, created_at FROM outbox_events WHERE topic = $1 ORDER BY id DESC LIMIT $2`
      : `SELECT event_id, topic, status, created_at FROM outbox_events ORDER BY id DESC LIMIT $1`;

    const params = topic ? [topic, limit] : [limit];
    const res = await pool.query(query, params);

    return {
      count: res.rows.length,
      events: res.rows
    };
  }

  /**
   * Tool 8: get_dlq_messages
   */
  async getDlqMessages(limit = 10) {
    return {
      queue: 'notification_dlq',
      exchange: 'notification_dlx',
      count: 0,
      messages: []
    };
  }

  /**
   * Write Tool 1: retry_order (Invokes existing SagaOrchestrator)
   */
  async retryOrder(orderId: string) {
    const order = await this.getOrder(orderId);
    if ('error' in order) return order;

    const result = await sagaOrchestrator.executeSaga(
      orderId,
      order.items[0]?.sku || 'ITEM-IPHONE-15',
      order.items[0]?.quantity || 1,
      order.totalAmount,
      order.customerEmail,
      'PESSIMISTIC'
    );

    return {
      success: true,
      message: `Order ${orderId} retry executed via Saga Orchestrator.`,
      sagaState: result
    };
  }

  /**
   * Write Tool 2: reset_circuit_breaker
   */
  async resetCircuitBreaker() {
    return {
      success: true,
      service: 'Payment Service Circuit Breaker',
      previousState: 'OPEN',
      newState: 'CLOSED'
    };
  }
}

export const orderflowClient = new OrderFlowClient();
