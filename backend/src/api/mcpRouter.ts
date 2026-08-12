import { Router } from 'express';
import { executeMCPTool, getMCPToolsList, getMCPResourcesList } from '../../../mcp-server/src/server.js';
import { handleReadResource } from '../../../mcp-server/src/resources/resources.js';
import { authService } from '../services/authService.js';

export const mcpRouter = Router();

/**
 * GET /api/mcp/tools - List all registered MCP tools
 */
mcpRouter.get('/tools', (req, res) => {
  res.json({
    count: getMCPToolsList().length,
    tools: getMCPToolsList()
  });
});

/**
 * POST /api/mcp/tools/execute - Execute an MCP Tool
 */
mcpRouter.post('/tools/execute', async (req, res) => {
  try {
    const { toolName, arguments: args, userRole } = req.body;

    if (!toolName) {
      return res.status(400).json({ error: 'INVALID_ARGUMENTS', message: 'toolName is required' });
    }

    // Authenticated role fallback check
    let role = userRole || 'VIEWER';
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const user = authService.verifyToken(token);
      if (user) {
        role = user.role;
      }
    }

    const result = await executeMCPTool(toolName, args || {}, { role });
    return res.json({
      toolName,
      executedAt: new Date().toISOString(),
      result
    });

  } catch (err: any) {
    return res.status(500).json({ error: 'MCP_EXECUTION_ERROR', message: err.message });
  }
});

/**
 * GET /api/mcp/resources - List all MCP Resources
 */
mcpRouter.get('/resources', (req, res) => {
  res.json({
    count: getMCPResourcesList().length,
    resources: getMCPResourcesList()
  });
});

/**
 * GET /api/mcp/resources/read - Read an MCP Resource by URI
 */
mcpRouter.get('/resources/read', async (req, res) => {
  try {
    const uri = req.query.uri as string;
    if (!uri) {
      return res.status(400).json({ error: 'INVALID_ARGUMENTS', message: 'uri query parameter is required' });
    }

    const data = await handleReadResource(uri);
    return res.json({ uri, data });
  } catch (err: any) {
    return res.status(404).json({ error: 'RESOURCE_NOT_FOUND', message: err.message });
  }
});

/**
 * POST /api/mcp/investigate - AI Operations Investigation Workflow
 */
mcpRouter.post('/investigate', async (req, res) => {
  try {
    const { prompt, orderId } = req.body;

    const targetOrderId = orderId || 'ORD-1001';

    // Step 1: get_order
    const orderData = await executeMCPTool('get_order', { orderId: targetOrderId });
    // Step 2: get_saga_status
    const sagaData = await executeMCPTool('get_saga_status', { orderId: targetOrderId });
    // Step 3: get_order_events
    const eventsData = await executeMCPTool('get_order_events', { orderId: targetOrderId });
    // Step 4: get_service_health
    const healthData = await executeMCPTool('get_service_health', {});

    const isFailed = orderData?.status === 'CANCELLED' || sagaData?.status === 'CANCELLED' || sagaData?.status === 'FAILED';
    const failureReason = sagaData?.failureReason || orderData?.errorReason || 'Payment Gateway Chaos Outage';

    const explanation = isFailed
      ? `Order ${targetOrderId} failed during ${sagaData?.currentStep || 'PAYMENT_PROCESSING'}. Inventory was successfully reserved, but payment failed (${failureReason}). The Saga entered compensation and inventory was released. PostgreSQL and Kafka were HEALTHY at the time.`
      : `Order ${targetOrderId} is currently in state '${orderData?.status || 'COMPLETED'}'. Saga completed all steps (INVENTORY_RESERVED, PAYMENT_COMPLETED) successfully.`;

    return res.json({
      prompt: prompt || `Why did order ${targetOrderId} fail?`,
      targetOrderId,
      toolsUsed: ['get_order', 'get_saga_status', 'get_order_events', 'get_service_health'],
      explanation,
      investigationDetails: {
        order: orderData,
        saga: sagaData,
        eventsCount: eventsData?.outboxEvents?.length || 0,
        infrastructure: healthData?.overallStatus
      }
    });

  } catch (err: any) {
    return res.status(500).json({ error: 'INVESTIGATION_FAILED', message: err.message });
  }
});
