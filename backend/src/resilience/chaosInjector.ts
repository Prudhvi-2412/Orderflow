export interface ChaosConfig {
  failureRate: number; // 0 to 100 percentage
  latencyMs: number;   // Injected latency delay
  forceOutage: boolean;// Force 100% outage
}

export class ChaosInjector {
  private config: ChaosConfig = {
    failureRate: 0,
    latencyMs: 0,
    forceOutage: false
  };

  setChaos(config: Partial<ChaosConfig>) {
    this.config = { ...this.config, ...config };
    console.log(`🔥 [Chaos Injector] Config Updated: FailureRate=${this.config.failureRate}%, Latency=${this.config.latencyMs}ms, Outage=${this.config.forceOutage}`);
  }

  async injectFault(serviceName: string): Promise<void> {
    // 1. Inject Artificial Latency Delay
    if (this.config.latencyMs > 0) {
      await new Promise((r) => setTimeout(r, this.config.latencyMs));
    }

    // 2. Inject Outage
    if (this.config.forceOutage) {
      throw new Error(`[Chaos Engineering] Injected Outage on ${serviceName} (HTTP 503 Service Unavailable).`);
    }

    // 3. Inject Randomized Failures
    if (this.config.failureRate > 0) {
      const rolled = Math.random() * 100;
      if (rolled < this.config.failureRate) {
        throw new Error(`[Chaos Engineering] Injected Fault on ${serviceName} (${this.config.failureRate}% Failure Triggered).`);
      }
    }
  }

  getConfig(): ChaosConfig {
    return { ...this.config };
  }
}

export const chaosInjector = new ChaosInjector();
