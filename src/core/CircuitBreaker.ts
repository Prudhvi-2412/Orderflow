export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerOptions {
  failureThreshold?: number;
  resetTimeoutMs?: number;
  successThreshold?: number;
}

export interface CircuitHistoryItem {
  id: string;
  event: string;
  detail: string;
  state: CircuitState;
  timestamp: number;
  isoTime: string;
}

export interface StateChangeEvent {
  name: string;
  oldState: CircuitState;
  newState: CircuitState;
  reason: string;
  timestamp: number;
  isoTime: string;
}

export class CircuitBreaker {
  public name: string;
  public failureThreshold: number;
  public resetTimeoutMs: number;
  public successThreshold: number;

  public state: CircuitState = 'CLOSED';
  public failureCount = 0;
  public successCount = 0;
  public lastStateChange: number = Date.now();
  public nextAttempt = 0;

  public history: CircuitHistoryItem[] = [];
  private listeners: ((event: StateChangeEvent) => void)[] = [];

  constructor(name = 'DefaultService', options: CircuitBreakerOptions = {}) {
    this.name = name;
    this.failureThreshold = options.failureThreshold || 3;
    this.resetTimeoutMs = options.resetTimeoutMs || 5000;
    this.successThreshold = options.successThreshold || 2;
  }

  onStateChange(listener: (event: StateChangeEvent) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  async execute<T>(
    actionFn: () => Promise<T>,
    fallbackFn: ((err: Error) => Promise<T>) | null = null
  ): Promise<T> {
    const now = Date.now();

    if (this.state === 'OPEN') {
      if (now >= this.nextAttempt) {
        this._transitionTo('HALF_OPEN', 'Reset timeout expired; testing downstream service availability.');
      } else {
        this._recordHistory('SHORT_CIRCUIT_BLOCKED', 'Service call rejected due to OPEN Circuit Breaker.');
        if (fallbackFn) {
          return await fallbackFn(new Error(`CircuitBreaker[${this.name}] is OPEN. Fast-failing.`));
        }
        throw new Error(`503 Service Unavailable: CircuitBreaker[${this.name}] is OPEN.`);
      }
    }

    try {
      const result = await actionFn();
      this._onSuccess();
      return result;
    } catch (err: any) {
      this._onFailure(err);
      if (fallbackFn) {
        return await fallbackFn(err);
      }
      throw err;
    }
  }

  private _onSuccess(): void {
    this.failureCount = 0;

    if (this.state === 'HALF_OPEN') {
      this.successCount++;
      this._recordHistory('HALF_OPEN_SUCCESS', `Probe request succeeded (${this.successCount}/${this.successThreshold})`);

      if (this.successCount >= this.successThreshold) {
        this._transitionTo('CLOSED', 'Service recovered successfully. Circuit Breaker closed.');
      }
    } else {
      this._recordHistory('SUCCESS', 'Action executed successfully.');
    }
  }

  private _onFailure(err: Error): void {
    this.failureCount++;
    this.successCount = 0;
    this._recordHistory('FAILURE', `Execution error: ${err.message}`);

    if (this.state === 'CLOSED' && this.failureCount >= this.failureThreshold) {
      this.nextAttempt = Date.now() + this.resetTimeoutMs;
      this._transitionTo('OPEN', `Failure threshold reached (${this.failureCount}/${this.failureThreshold}). Circuit Breaker OPENED.`);
    } else if (this.state === 'HALF_OPEN') {
      this.nextAttempt = Date.now() + this.resetTimeoutMs;
      this._transitionTo('OPEN', 'Probe request failed in HALF_OPEN state. Re-opening Circuit Breaker.');
    }
  }

  private _transitionTo(newState: CircuitState, reason: string): void {
    const oldState = this.state;
    this.state = newState;
    this.lastStateChange = Date.now();

    if (newState === 'CLOSED') {
      this.failureCount = 0;
      this.successCount = 0;
    }

    const event: StateChangeEvent = {
      name: this.name,
      oldState,
      newState,
      reason,
      timestamp: Date.now(),
      isoTime: new Date().toISOString()
    };

    this._recordHistory('STATE_CHANGE', `Transitioned from ${oldState} -> ${newState}. Reason: ${reason}`);
    this.listeners.forEach((l) => {
      try {
        l(event);
      } catch (e) {}
    });
  }

  forceState(state: CircuitState): void {
    this._transitionTo(state, `Manually forced state to ${state}`);
  }

  getState() {
    return {
      name: this.name,
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      nextAttemptIn: this.state === 'OPEN' ? Math.max(0, Math.ceil((this.nextAttempt - Date.now()) / 1000)) : 0
    };
  }

  private _recordHistory(event: string, detail: string): void {
    this.history.unshift({
      id: `cb_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      event,
      detail,
      state: this.state,
      timestamp: Date.now(),
      isoTime: new Date().toISOString()
    });
    if (this.history.length > 50) this.history.pop();
  }
}
