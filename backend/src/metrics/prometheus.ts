import promClient from 'prom-client';

export const register = new promClient.Registry();

// Enable default Node.js process metrics (CPU, Memory, GC, Event Loop)
promClient.collectDefaultMetrics({ register, prefix: 'orderflow_process_' });

// 1. Order Status Counter
export const ordersTotalCounter = new promClient.Counter({
  name: 'orderflow_orders_total',
  help: 'Total count of processed orders',
  labelNames: ['status', 'lock_strategy'],
  registers: [register]
});

// 2. HTTP Request Duration Histogram
export const httpRequestDurationHistogram = new promClient.Histogram({
  name: 'orderflow_http_request_duration_seconds',
  help: 'Histogram of HTTP request latencies in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [register]
});

// 3. Circuit Breaker State Gauge
export const circuitBreakerGauge = new promClient.Gauge({
  name: 'orderflow_circuit_breaker_state',
  help: 'Circuit Breaker State (0=CLOSED, 1=HALF_OPEN, 2=OPEN)',
  labelNames: ['name'],
  registers: [register]
});

// 4. Inventory Stock Gauge
export const inventoryStockGauge = new promClient.Gauge({
  name: 'orderflow_inventory_stock_quantity',
  help: 'Current inventory stock quantity',
  labelNames: ['sku'],
  registers: [register]
});
