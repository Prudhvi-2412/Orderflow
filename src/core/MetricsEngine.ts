export interface ServiceMetricsData {
  requests: number;
  errors: number;
  latencies: number[];
}

export interface LatencyPercentiles {
  p50: number;
  p95: number;
  p99: number;
  avg: number;
}

export interface SystemMetricsReport {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  rps: number;
  errorRate: number;
  latencies: LatencyPercentiles;
  services: Record<string, { requests: number; errors: number; latencies: LatencyPercentiles }>;
}

export class MetricsEngine {
  public latencies: number[] = [];
  public requestTimestamps: number[] = [];
  public totalRequests = 0;
  public successfulRequests = 0;
  public failedRequests = 0;

  public serviceBreakdown: Record<string, ServiceMetricsData> = {
    OrderService: { requests: 0, errors: 0, latencies: [] },
    InventoryService: { requests: 0, errors: 0, latencies: [] },
    PaymentService: { requests: 0, errors: 0, latencies: [] },
    ShippingService: { requests: 0, errors: 0, latencies: [] }
  };

  private listeners: ((metrics: SystemMetricsReport) => void)[] = [];

  onMetricsUpdate(listener: (metrics: SystemMetricsReport) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  record(serviceName: string, latencyMs: number, isSuccess = true): void {
    const now = Date.now();
    this.totalRequests++;
    if (isSuccess) this.successfulRequests++;
    else this.failedRequests++;

    this.latencies.push(latencyMs);
    if (this.latencies.length > 500) this.latencies.shift();

    this.requestTimestamps.push(now);
    const tenSecAgo = now - 10000;
    this.requestTimestamps = this.requestTimestamps.filter((t) => t >= tenSecAgo);

    if (this.serviceBreakdown[serviceName]) {
      const svc = this.serviceBreakdown[serviceName];
      svc.requests++;
      if (!isSuccess) svc.errors++;
      svc.latencies.push(latencyMs);
      if (svc.latencies.length > 100) svc.latencies.shift();
    }

    this._notify();
  }

  calculatePercentiles(arr: number[]): LatencyPercentiles {
    if (!arr || arr.length === 0) return { p50: 0, p95: 0, p99: 0, avg: 0 };
    const sorted = [...arr].sort((a, b) => a - b);
    const getPercentile = (p: number) => {
      const idx = Math.ceil((p / 100) * sorted.length) - 1;
      return sorted[Math.max(0, idx)];
    };
    const sum = sorted.reduce((a, b) => a + b, 0);

    return {
      p50: Math.round(getPercentile(50)),
      p95: Math.round(getPercentile(95)),
      p99: Math.round(getPercentile(99)),
      avg: Math.round(sum / sorted.length)
    };
  }

  getMetrics(): SystemMetricsReport {
    const rps = (this.requestTimestamps.length / 10).toFixed(1);
    const overallLatencies = this.calculatePercentiles(this.latencies);
    const errorRate =
      this.totalRequests > 0 ? ((this.failedRequests / this.totalRequests) * 100).toFixed(1) : '0.0';

    const services: Record<string, { requests: number; errors: number; latencies: LatencyPercentiles }> = {};
    for (const [name, data] of Object.entries(this.serviceBreakdown)) {
      services[name] = {
        requests: data.requests,
        errors: data.errors,
        latencies: this.calculatePercentiles(data.latencies)
      };
    }

    return {
      totalRequests: this.totalRequests,
      successfulRequests: this.successfulRequests,
      failedRequests: this.failedRequests,
      rps: parseFloat(rps),
      errorRate: parseFloat(errorRate),
      latencies: overallLatencies,
      services
    };
  }

  reset(): void {
    this.latencies = [];
    this.requestTimestamps = [];
    this.totalRequests = 0;
    this.successfulRequests = 0;
    this.failedRequests = 0;
    for (const key of Object.keys(this.serviceBreakdown)) {
      this.serviceBreakdown[key] = { requests: 0, errors: 0, latencies: [] };
    }
    this._notify();
  }

  private _notify(): void {
    const data = this.getMetrics();
    this.listeners.forEach((l) => {
      try {
        l(data);
      } catch (e) {}
    });
  }
}

export const globalMetrics = new MetricsEngine();
