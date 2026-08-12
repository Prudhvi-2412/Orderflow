export type IdempotencyStatus = 'PENDING' | 'COMPLETED' | 'FAILED';

export interface IdempotencyRecord {
  key: string;
  status: IdempotencyStatus;
  payloadHash: string;
  createdAt: number;
  updatedAt: number;
  response: any | null;
  errorReason?: string;
}

export interface IdempotencyResult {
  action: 'PROCEED' | 'SERVE_CACHE' | 'IN_PROGRESS' | 'PAYLOAD_MISMATCH';
  response?: any;
  cachedAt?: number;
  error?: string;
}

export interface IdempotencyHistoryItem {
  id: string;
  action: string;
  key: string;
  status: string;
  hash: string;
  timestamp: number;
  isoTime: string;
}

export class IdempotencyManager {
  private store = new Map<string, IdempotencyRecord>();
  public stats = {
    totalRequests: 0,
    cachedHits: 0,
    inFlightConflicts: 0,
    payloadMismatches: 0
  };
  public history: IdempotencyHistoryItem[] = [];
  private listeners: ((event: any) => void)[] = [];

  onIdempotencyEvent(listener: (event: any) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private _hashPayload(payload: any): string {
    const str = typeof payload === 'string' ? payload : JSON.stringify(payload || {});
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0;
    }
    return hash.toString(16);
  }

  begin(key: string, payload: any): IdempotencyResult {
    this.stats.totalRequests++;
    const payloadHash = this._hashPayload(payload);
    const existing = this.store.get(key);

    if (!existing) {
      const record: IdempotencyRecord = {
        key,
        status: 'PENDING',
        payloadHash,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        response: null
      };
      this.store.set(key, record);
      this._recordHistory('NEW_REQUEST', key, 'PENDING', payloadHash);
      return { action: 'PROCEED' };
    }

    if (existing.status === 'PENDING') {
      this.stats.inFlightConflicts++;
      this._recordHistory('IN_FLIGHT_CONFLICT', key, 'PENDING', payloadHash);
      this._notify({ type: 'IDEMPOTENCY_CONFLICT', key });
      return {
        action: 'IN_PROGRESS',
        error: '409 Conflict: Request with this Idempotency-Key is currently being processed by another worker.'
      };
    }

    if (existing.status === 'COMPLETED') {
      if (existing.payloadHash !== payloadHash) {
        this.stats.payloadMismatches++;
        this._recordHistory('PAYLOAD_MISMATCH', key, 'REJECTED', payloadHash);
        this._notify({ type: 'IDEMPOTENCY_MISMATCH', key });
        return {
          action: 'PAYLOAD_MISMATCH',
          error: '422 Unprocessable: Idempotency-Key was already used with a different request payload.'
        };
      }

      this.stats.cachedHits++;
      this._recordHistory('SERVE_CACHE', key, 'COMPLETED', payloadHash);
      this._notify({ type: 'IDEMPOTENCY_HIT', key });
      return {
        action: 'SERVE_CACHE',
        response: existing.response,
        cachedAt: existing.updatedAt
      };
    }

    existing.status = 'PENDING';
    existing.payloadHash = payloadHash;
    existing.updatedAt = Date.now();
    return { action: 'PROCEED' };
  }

  complete(key: string, response: any): void {
    const existing = this.store.get(key);
    if (existing) {
      existing.status = 'COMPLETED';
      existing.response = response;
      existing.updatedAt = Date.now();
      this._recordHistory('COMPLETE', key, 'COMPLETED', existing.payloadHash);
    }
  }

  fail(key: string, errorReason: string): void {
    const existing = this.store.get(key);
    if (existing) {
      existing.status = 'FAILED';
      existing.errorReason = errorReason;
      existing.updatedAt = Date.now();
      this._recordHistory('FAIL', key, 'FAILED', existing.payloadHash);
    }
  }

  getStats() {
    return { ...this.stats };
  }

  getHistory(limit = 50): IdempotencyHistoryItem[] {
    return this.history.slice(0, limit);
  }

  clear(): void {
    this.store.clear();
    this.stats = { totalRequests: 0, cachedHits: 0, inFlightConflicts: 0, payloadMismatches: 0 };
    this.history = [];
  }

  private _recordHistory(action: string, key: string, status: string, hash: string): void {
    this.history.unshift({
      id: `idemp_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      action,
      key,
      status,
      hash,
      timestamp: Date.now(),
      isoTime: new Date().toISOString()
    });
  }

  private _notify(event: any): void {
    this.listeners.forEach((l) => {
      try {
        l(event);
      } catch (e) {}
    });
  }
}

export const globalIdempotencyManager = new IdempotencyManager();
