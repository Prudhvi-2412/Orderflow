export class RateLimiter {
  public capacity: number;
  public refillRatePerSec: number;
  public tokens: number;
  public lastRefill: number;
  public rejectedCount = 0;

  constructor(capacity = 20, refillRatePerSec = 5) {
    this.capacity = capacity;
    this.refillRatePerSec = refillRatePerSec;
    this.tokens = capacity;
    this.lastRefill = Date.now();
  }

  refill(): void {
    const now = Date.now();
    const elapsedSec = (now - this.lastRefill) / 1000;
    if (elapsedSec > 0) {
      const addedTokens = elapsedSec * this.refillRatePerSec;
      this.tokens = Math.min(this.capacity, this.tokens + addedTokens);
      this.lastRefill = now;
    }
  }

  tryAcquire(cost = 1): boolean {
    this.refill();
    if (this.tokens >= cost) {
      this.tokens -= cost;
      return true;
    }
    this.rejectedCount++;
    return false;
  }

  getStatus() {
    this.refill();
    return {
      tokens: Math.floor(this.tokens),
      capacity: this.capacity,
      rejectedCount: this.rejectedCount
    };
  }

  reset(): void {
    this.tokens = this.capacity;
    this.lastRefill = Date.now();
    this.rejectedCount = 0;
  }
}
