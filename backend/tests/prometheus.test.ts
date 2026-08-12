import { register, ordersTotalCounter } from '../src/metrics/prometheus.js';

describe('Prometheus Metrics & Scraping Endpoint Tests', () => {

  it('should register custom counters and export valid Prometheus format string', async () => {
    ordersTotalCounter.inc({ status: 'COMPLETED', lock_strategy: 'PESSIMISTIC' });

    const metricsOutput = await register.metrics();

    expect(metricsOutput).toContain('orderflow_orders_total');
    expect(metricsOutput).toContain('status="COMPLETED"');
    expect(metricsOutput).toContain('lock_strategy="PESSIMISTIC"');
  });

});
