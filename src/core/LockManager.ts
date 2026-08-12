export interface LockInfo {
  resourceKey: string;
  ownerId: string;
  acquiredAt: number;
  expiresAt: number;
  fenceToken: number;
  remainingTtl?: number;
}

export interface LockHistoryItem {
  id: string;
  action: string;
  resourceKey: string;
  ownerId: string;
  fenceToken: number | null;
  success: boolean;
  duration: number;
  timestamp: number;
  isoTime: string;
}

export class LockManager {
  private locks = new Map<string, LockInfo>();
  public lockHistory: LockHistoryItem[] = [];
  public fenceCounter = 0;
  public contentionCount = 0;
  private listeners: ((event: any) => void)[] = [];

  onLockEvent(listener: (event: any) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  async acquire(resourceKey: string, ownerId: string, ttlMs = 5000): Promise<LockInfo | null> {
    const now = Date.now();
    const existing = this.locks.get(resourceKey);

    if (existing && existing.expiresAt > now) {
      if (existing.ownerId === ownerId) {
        existing.expiresAt = now + ttlMs;
        this._recordHistory('RENEWED', resourceKey, ownerId, existing.fenceToken, true);
        return existing;
      }

      this.contentionCount++;
      this._recordHistory('COLLISION_FAILED', resourceKey, ownerId, null, false);
      this._notify({ type: 'LOCK_COLLISION', resourceKey, ownerId });
      return null;
    }

    this.fenceCounter++;
    const lockInfo: LockInfo = {
      resourceKey,
      ownerId,
      acquiredAt: now,
      expiresAt: now + ttlMs,
      fenceToken: this.fenceCounter
    };

    this.locks.set(resourceKey, lockInfo);
    this._recordHistory('ACQUIRED', resourceKey, ownerId, lockInfo.fenceToken, true);
    this._notify({ type: 'LOCK_ACQUIRED', lockInfo });

    return lockInfo;
  }

  async release(resourceKey: string, ownerId: string): Promise<boolean> {
    const existing = this.locks.get(resourceKey);
    const now = Date.now();

    if (!existing) {
      this._recordHistory('RELEASE_NOT_FOUND', resourceKey, ownerId, null, false);
      return false;
    }

    if (existing.ownerId !== ownerId) {
      this._recordHistory('RELEASE_UNAUTHORIZED', resourceKey, ownerId, existing.fenceToken, false);
      this._notify({ type: 'LOCK_RELEASE_DENIED', resourceKey, ownerId, currentOwner: existing.ownerId });
      return false;
    }

    this.locks.delete(resourceKey);
    const duration = now - existing.acquiredAt;
    this._recordHistory('RELEASED', resourceKey, ownerId, existing.fenceToken, true, duration);
    this._notify({ type: 'LOCK_RELEASED', resourceKey, ownerId, duration });
    return true;
  }

  async acquireWithRetry(
    resourceKey: string,
    ownerId: string,
    ttlMs = 5000,
    maxRetries = 10,
    retryDelayMs = 50
  ): Promise<LockInfo | null> {
    let attempt = 0;
    while (attempt < maxRetries) {
      attempt++;
      const lock = await this.acquire(resourceKey, ownerId, ttlMs);
      if (lock) return lock;

      const jitter = Math.floor(Math.random() * 20);
      await new Promise((r) => setTimeout(r, retryDelayMs + jitter));
    }
    return null;
  }

  getActiveLocks(): LockInfo[] {
    const now = Date.now();
    const active: LockInfo[] = [];
    for (const [key, lock] of this.locks.entries()) {
      if (lock.expiresAt > now) {
        active.push({ ...lock, remainingTtl: lock.expiresAt - now });
      } else {
        this.locks.delete(key);
      }
    }
    return active;
  }

  getHistory(limit = 50): LockHistoryItem[] {
    return this.lockHistory.slice(0, limit);
  }

  private _recordHistory(
    action: string,
    resourceKey: string,
    ownerId: string,
    fenceToken: number | null,
    success: boolean,
    duration = 0
  ): void {
    this.lockHistory.unshift({
      id: `lock_op_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      action,
      resourceKey,
      ownerId,
      fenceToken,
      success,
      duration,
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

export const globalLockManager = new LockManager();
