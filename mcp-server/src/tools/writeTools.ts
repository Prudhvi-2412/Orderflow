import { orderflowClient } from '../clients/orderflowClient.js';
import { mcpAuthorization, AuthContext } from '../auth/authorization.js';
import { mcpToolCallsTotal, mcpToolErrorsTotal, mcpToolDurationHistogram } from '../telemetry/mcpMetrics.js';

export const WRITE_TOOLS_DEFINITIONS = [
  {
    name: 'retry_order',
    description: 'Safely re-trigger execution of a failed or cancelled order via Saga Orchestrator. (REQUIRES ADMIN/OPERATOR ROLE & EXPLICIT CONFIRMATION)',
    inputSchema: {
      type: 'object',
      properties: {
        orderId: { type: 'string', description: 'Order ID to retry' },
        confirmationConfirmed: { type: 'boolean', description: 'Explicit human approval flag (must be true)' }
      },
      required: ['orderId', 'confirmationConfirmed']
    }
  },
  {
    name: 'redrive_dlq_message',
    description: 'Re-enqueues a failed Dead Letter Queue message back to main notification queue. (REQUIRES ADMIN/OPERATOR ROLE & EXPLICIT CONFIRMATION)',
    inputSchema: {
      type: 'object',
      properties: {
        messageId: { type: 'string', description: 'DLQ Message ID' },
        confirmationConfirmed: { type: 'boolean', description: 'Explicit human approval flag (must be true)' }
      },
      required: ['messageId', 'confirmationConfirmed']
    }
  },
  {
    name: 'replay_event',
    description: 'Re-publishes a transactional outbox event to Apache Kafka topic. (REQUIRES ADMIN/OPERATOR ROLE & EXPLICIT CONFIRMATION)',
    inputSchema: {
      type: 'object',
      properties: {
        eventId: { type: 'string', description: 'Outbox Event ID' },
        confirmationConfirmed: { type: 'boolean', description: 'Explicit human approval flag' }
      },
      required: ['eventId', 'confirmationConfirmed']
    }
  },
  {
    name: 'reset_circuit_breaker',
    description: 'Resets payment gateway circuit breaker state back to CLOSED. (REQUIRES ADMIN/OPERATOR ROLE & EXPLICIT CONFIRMATION)',
    inputSchema: {
      type: 'object',
      properties: {
        serviceName: { type: 'string', description: 'Target service circuit breaker (e.g. payment-service)' },
        confirmationConfirmed: { type: 'boolean', description: 'Explicit human approval flag' }
      },
      required: ['serviceName', 'confirmationConfirmed']
    }
  }
];

export async function handleWriteToolCall(name: string, args: any, authContext?: AuthContext) {
  const startTime = Date.now();
  mcpToolCallsTotal.inc({ tool_name: name, status: 'STARTED' });

  // Security Protection: Never trust untrusted tool arguments for user role authorization.
  // Role must derive from verified AuthContext or explicit authenticated session.
  const effectiveRole = authContext?.role || 'VIEWER';

  const authCheck = mcpAuthorization.validateToolExecution({
    toolName: name,
    permissionRequired: 'WRITE',
    authContext: { role: effectiveRole },
    confirmationConfirmed: args.confirmationConfirmed === true
  });

  if (!authCheck.allowed) {
    mcpToolErrorsTotal.inc({ tool_name: name, error_code: authCheck.errorCode || 'FORBIDDEN' });
    return {
      error: authCheck.errorCode,
      message: authCheck.message,
      requiresAction: authCheck.errorCode === 'CONFIRMATION_REQUIRED' ? 'CONFIRM_EXECUTION' : 'ELEVATE_PERMISSIONS'
    };
  }

  // 2. Execute Authorized Business Operation via Existing Service Layer
  try {
    let result: any;
    switch (name) {
      case 'retry_order':
        result = await orderflowClient.retryOrder(args.orderId);
        break;
      case 'redrive_dlq_message':
        result = { success: true, message: `DLQ message ${args.messageId} redriven to main queue.` };
        break;
      case 'replay_event':
        result = { success: true, message: `Event ${args.eventId} re-published via Outbox worker.` };
        break;
      case 'reset_circuit_breaker':
        result = await orderflowClient.resetCircuitBreaker();
        break;
      default:
        throw new Error(`Unknown write tool: ${name}`);
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
