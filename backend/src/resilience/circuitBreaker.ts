export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerOptions {
  failureThreshold?: number;     // Failures before opening (default: 3)
  resetTimeoutMs?: number;       // Time in OPEN state before probing (default: 5000ms)
  halfOpenSuccesses?: number;    // Successes in HALF_OPEN to close (default: 2)
  name?: string;
}

export class CircuitBreaker {
  public state: CircuitState = 'CLOSED';
  public failureCount = 0;
  public successCount = 0;
  public lastStateChange: number = Date.now();
  public nextAttempt: number = Date.now();

  private failureThreshold: number;
  private resetTimeoutMs: number;
  private halfOpenSuccessesNeeded: number;
  public name: string;

  constructor(options: CircuitBreakerOptions = {}) {
    this.failureThreshold = options.failureThreshold || 3;
    this.resetTimeoutMs = options.resetTimeoutMs || 5000;
    this.halfOpenSuccessesNeeded = options.halfOpenSuccesses || 2;
    this.name = options.name || 'DefaultCircuitBreaker';
  }

  /**
   * Execute Protected Function
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    const now = Date.now();

    // 1. Check if OPEN state timer has expired -> Transition to HALF_OPEN
    if (this.state === 'OPEN') {
      if (now >= this.nextAttempt) {
        this.transitionTo('HALF_OPEN');
      } else {
        const remaining = Math.ceil((this.nextAttempt - now) / 1000);
        throw new Error(`CircuitBreaker [${this.name}] is OPEN. Request fast-failed. Retry in ${remaining}s.`);
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (err: any) {
      this.onFailure(err);
      throw err;
    }
  }

  private onSuccess() {
    if (this.state === 'HALF_OPEN') {
      this.successCount++;
      if (this.successCount >= this.halfOpenSuccessesNeeded) {
        this.transitionTo('CLOSED');
      }
    } else if (this.state === 'CLOSED') {
      this.failureCount = 0;
    }
  }

  private onFailure(err: any) {
    this.failureCount++;
    if (this.state === 'CLOSED' && this.failureCount >= this.failureThreshold) {
      this.transitionTo('OPEN');
    } else if (this.state === 'HALF_OPEN') {
      this.transitionTo('OPEN');
    }
  }

  private transitionTo(newState: CircuitState) {
    console.log(`⚡ CircuitBreaker [${this.name}] state changed: ${this.state} ➔ ${newState}`);
    this.state = newState;
    this.lastStateChange = Date.now();

    if (newState === 'OPEN') {
      this.nextAttempt = Date.now() + this.resetTimeoutMs;
      this.successCount = 0;
    } else if (newState === 'HALF_OPEN') {
      this.successCount = 0;
    } else if (newState === 'CLOSED') {
      this.failureCount = 0;
      this.successCount = 0;
    }
  }

  getStatus() {
    return {
      name: this.name,
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastStateChange: this.lastStateChange,
      nextAttempt: this.nextAttempt
    };
  }
}
