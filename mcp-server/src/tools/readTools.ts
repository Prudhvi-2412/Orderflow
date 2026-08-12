import { orderflowClient } from '../clients/orderflowClient.js';
import { mcpAuthorization } from '../auth/authorization.js';
import { mcpToolCallsTotal, mcpToolErrorsTotal, mcpToolDurationHistogram } from '../telemetry/mcpMetrics.js';

export const READ_TOOLS_DEFINITIONS = [
  {
    name: 'get_order',
    description: 'Inspect complete order details, status, line items, payment, and inventory status by order ID.',
    inputSchema: {
      type: 'object',
      properties: {
        orderId: { type: 'string', description: 'The unique order identifier (e.g. ORD-1024)' }
      },
      required: ['orderId']
    }
  },
  {
    name: 'get_saga_status',
    description: 'Retrieve complete Saga state machine execution status, step timeline, and compensation status for an order.',
    inputSchema: {
      type: 'object',
      properties: {
        orderId: { type: 'string', description: 'The unique order identifier' }
      },
      required: ['orderId']
    }
  },
  {
    name: 'get_order_events',
    description: 'Fetch all outbox and processed Kafka consumer events associated with a specific order ID.',
    inputSchema: {
      type: 'object',
      properties: {
        orderId: { type: 'string', description: 'The unique order identifier' }
      },
      required: ['orderId']
    }
  },
  {
    name: 'get_inventory',
    description: 'Inspect current SKU stock level, version CAS status, and availability.',
    inputSchema: {
      type: 'object',
      properties: {
        sku: { type: 'string', description: 'Stock Keeping Unit identifier (e.g. ITEM-IPHONE-15)' }
      },
      required: ['sku']
    }
  },
  {
    name: 'get_service_health',
    description: 'Check actual real-time health status of PostgreSQL, Redis, Kafka, RabbitMQ, and API Gateway.',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'get_system_metrics',
    description: 'Retrieve real-time platform metrics: request throughput (RPS), P50/P95/P99 latencies, error counts, outbox queue size.',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'get_kafka_events',
    description: 'Inspect recent Kafka topic event log messages without exposing sensitive credentials.',
    inputSchema: {
      type: 'object',
      properties: {
        topic: { type: 'string', description: 'Optional topic filter (e.g. OrderCreated)' },
        limit: { type: 'number', description: 'Max events to return (default 10)' }
      }
    }
  },
  {
    name: 'get_dlq_messages',
    description: 'Inspect dead-letter queue (DLQ) messages from RabbitMQ notification_dlq.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Max DLQ messages to return (default 10)' }
      }
    }
  }
];

export async function handleReadToolCall(name: string, args: any) {
  const startTime = Date.now();
  try {
    mcpToolCallsTotal.inc({ tool_name: name, status: 'STARTED' });

    let result: any;
    switch (name) {
      case 'get_order':
        result = await orderflowClient.getOrder(args.orderId);
        break;
      case 'get_saga_status':
        result = await orderflowClient.getSagaStatus(args.orderId);
        break;
      case 'get_order_events':
        result = await orderflowClient.getOrderEvents(args.orderId);
        break;
      case 'get_inventory':
        result = await orderflowClient.getInventory(args.sku);
        break;
      case 'get_service_health':
        result = await orderflowClient.getServiceHealth();
        break;
      case 'get_system_metrics':
        result = await orderflowClient.getSystemMetrics();
        break;
      case 'get_kafka_events':
        result = await orderflowClient.getKafkaEvents(args.topic, args.limit);
        break;
      case 'get_dlq_messages':
        result = await orderflowClient.getDlqMessages(args.limit);
        break;
      default:
        throw new Error(`Unknown read tool: ${name}`);
    }

    const duration = (Date.now() - startTime) / 1000;
    mcpToolDurationHistogram.observe({ tool_name: name }, duration);
    mcpToolCallsTotal.inc({ tool_name: name, status: 'SUCCESS' });

    return mcpAuthorization.sanitizeOutput(result);

  } catch (err: any) {
    mcpToolErrorsTotal.inc({ tool_name: name, error_code: 'EXECUTION_ERROR' });
    return { error: 'TOOL_EXECUTION_FAILED', toolName: name, message: err.message };
  }
}
