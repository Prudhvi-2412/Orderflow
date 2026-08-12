import { Counter, Histogram } from 'prom-client';

export const mcpToolCallsTotal = new Counter({
  name: 'mcp_tool_calls_total',
  help: 'Total number of MCP AI Operations tool invocations',
  labelNames: ['tool_name', 'status']
});

export const mcpToolErrorsTotal = new Counter({
  name: 'mcp_tool_errors_total',
  help: 'Total number of failed MCP tool executions',
  labelNames: ['tool_name', 'error_code']
});

export const mcpToolDurationHistogram = new Histogram({
  name: 'mcp_tool_duration_seconds',
  help: 'Execution duration of MCP tool calls in seconds',
  labelNames: ['tool_name'],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5]
});
