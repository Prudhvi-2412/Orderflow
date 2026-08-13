import { executeMCPTool, getMCPToolsList, getMCPResourcesList } from '../../mcp-server/src/server.js';
import { handleReadResource } from '../../mcp-server/src/resources/resources.js';
import { mcpAuthorization } from '../../mcp-server/src/auth/authorization.js';
import { pool } from '../src/config/db.js';

describe('OrderFlow MCP AI Operations Tools & Resources Test Suite', () => {

  const testOrderId = `ORD-MCP-TEST-${Date.now()}`;

  beforeAll(async () => {
    // Seed SKU in database inventory table
    await pool.query(
      `INSERT INTO inventory (sku, name, stock_quantity, version)
       VALUES ('ITEM-IPHONE-15', 'iPhone 15 Pro', 1000, 1)
       ON CONFLICT (sku) DO UPDATE SET stock_quantity = 1000`
    );

    // Seed test order
    await pool.query(
      `INSERT INTO orders (order_id, customer_email, total_amount, status, lock_strategy)
       VALUES ($1, 'mcp.user@orderflow.io', 999.00, 'CANCELLED', 'PESSIMISTIC')
       ON CONFLICT (order_id) DO NOTHING`,
      [testOrderId]
    );
  });

  it('should register both READ and WRITE MCP tools', () => {
    const tools = getMCPToolsList();
    expect(tools.length).toBeGreaterThanOrEqual(12);

    const toolNames = tools.map((t) => t.name);
    expect(toolNames).toContain('get_order');
    expect(toolNames).toContain('get_saga_status');
    expect(toolNames).toContain('get_service_health');
    expect(toolNames).toContain('retry_order');
    expect(toolNames).toContain('reset_circuit_breaker');
  });

  it('Tool 1: get_order should return real order details and handle missing order', async () => {
    const res = await executeMCPTool('get_order', { orderId: testOrderId });
    expect(res.orderId).toBe(testOrderId);
    expect(res.customerEmail).toBe('mcp.user@orderflow.io');
    expect(res.status).toBe('CANCELLED');

    const missingRes = await executeMCPTool('get_order', { orderId: 'ORD-DOES-NOT-EXIST' });
    expect(missingRes.error).toBe('ORDER_NOT_FOUND');
  });

  it('Tool 2: get_saga_status should return complete Saga state machine execution status', async () => {
    const saga = await executeMCPTool('get_saga_status', { orderId: testOrderId });
    expect(saga.orderId).toBe(testOrderId);
    expect(saga.sagaId).toBe(`saga_${testOrderId}`);
  });

  it('Tool 4 & 5: get_inventory & get_service_health should return real status', async () => {
    const stock = await executeMCPTool('get_inventory', { sku: 'ITEM-IPHONE-15' });
    expect(stock.sku).toBe('ITEM-IPHONE-15');
    expect(typeof stock.stockQuantity).toBe('number');

    const health = await executeMCPTool('get_service_health', {});
    expect(health.services).toBeDefined();
    expect(health.services.postgresql.status).toBe('HEALTHY');
  });

  it('Tool 6: get_system_metrics should return system RED metrics', async () => {
    const metrics = await executeMCPTool('get_system_metrics', {});
    expect(metrics.throughputRps).toBeDefined();
    expect(metrics.latenciesMs).toBeDefined();
  });

  it('Write Tool Security: retry_order should block unauthorized roles', async () => {
    const res = await executeMCPTool(
      'retry_order',
      {
        orderId: testOrderId,
        confirmationConfirmed: true
      },
      { role: 'VIEWER' }
    );

    expect(res.error).toBe('FORBIDDEN');
    expect(res.message).toContain('requires ADMIN or OPERATOR role');
  });

  it('Write Tool Security: retry_order should reject unconfirmed human operations', async () => {
    const res = await executeMCPTool(
      'retry_order',
      {
        orderId: testOrderId,
        confirmationConfirmed: false // Missing confirmation!
      },
      { role: 'ADMIN' }
    );

    expect(res.error).toBe('CONFIRMATION_REQUIRED');
    expect(res.requiresAction).toBe('CONFIRM_EXECUTION');
  });

  it('Write Tool Execution: retry_order should execute when authorized with confirmation', async () => {
    const res = await executeMCPTool(
      'retry_order',
      {
        orderId: testOrderId,
        confirmationConfirmed: true
      },
      { role: 'ADMIN' }
    );

    expect(res.success).toBe(true);
    expect(res.message).toContain('retry executed');
  });

  it('MCP Resources: handleReadResource should return structured resources', async () => {
    const arch: any = await handleReadResource('orderflow://architecture');
    expect(arch.architecture).toContain('Event-Driven');

    const topics: any = await handleReadResource('orderflow://kafka/topics');
    expect(topics.topics).toContain('OrderCreated');
  });

  it('Security: sanitizeOutput should redact passwords and tokens', () => {
    const rawData = { user: 'admin', password: 'supersecretpassword123', token: 'bearer-jwt-token' };
    const sanitized = mcpAuthorization.sanitizeOutput(rawData);
    expect(sanitized.password).toBe('[REDACTED]');
    expect(sanitized.token).toBe('[REDACTED]');
  });

});
