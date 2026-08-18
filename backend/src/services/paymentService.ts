import { CircuitBreaker } from '../resilience/circuitBreaker.js';
import { chaosInjector } from '../resilience/chaosInjector.js';
import { pool } from '../config/db.js';

export interface PaymentResult {
  success: boolean;
  txnId: string;
  amount: number;
  idempotencyKey: string;
  error?: string;
  isDuplicate?: boolean;
}

export class PaymentService {
  public circuitBreaker: CircuitBreaker;
  private paymentCache: Map<string, PaymentResult> = new Map();
  private gatewayLedger: Map<string, PaymentResult> = new Map(); // Gateway internal idempotency ledger
  private lostResponseKeys: Set<string> = new Set(); // Keys configured to simulate lost network response on 1st call

  constructor() {
    this.circuitBreaker = new CircuitBreaker({
      name: 'PaymentGatewayCircuitBreaker',
      failureThreshold: 3,
      resetTimeoutMs: 2000,
      halfOpenSuccesses: 2
    });
  }

  setChaos(failureRate: number, forceOutage: boolean) {
    chaosInjector.setChaos({ failureRate, forceOutage });
  }

  /**
   * Mock utility: Instruct gateway to process payment but drop response (timeout) on 1st attempt
   */
  simulateLostResponse(idempotencyKey: string) {
    this.lostResponseKeys.add(idempotencyKey);
  }

  async processPayment(
    orderId: string,
    amount: number,
    customerEmail: string,
    idempotencyKey?: string
  ): Promise<PaymentResult> {
    const key = idempotencyKey || `pay_${orderId}`;

    // 1. Gateway Ledger Check: Simulated external payment provider idempotency check
    if (this.gatewayLedger.has(key)) {
      const existing = this.gatewayLedger.get(key)!;
      this.paymentCache.set(key, existing);
      return { ...existing, isDuplicate: true };
    }

    // 2. Fast Path: Check in-memory payment cache
    if (this.paymentCache.has(key)) {
      const cached = this.paymentCache.get(key)!;
      return { ...cached, isDuplicate: true };
    }

    // 3. Persistent Check: Look up existing payment record in PostgreSQL
    try {
      const dbRes = await pool.query(
        `SELECT txn_id, amount, status FROM payments WHERE order_id = $1 OR idempotency_key = $2`,
        [orderId, key]
      );
      if (dbRes.rows.length > 0 && dbRes.rows[0].status === 'SUCCESS') {
        const result: PaymentResult = {
          success: true,
          txnId: dbRes.rows[0].txn_id,
          amount: parseFloat(dbRes.rows[0].amount),
          idempotencyKey: key,
          isDuplicate: true
        };
        this.paymentCache.set(key, result);
        this.gatewayLedger.set(key, result);
        return result;
      }
    } catch (err) {
      // Non-blocking in case payments table query is run before migration
    }

    // 4. Execute Settlement protected by CircuitBreaker
    return await this.circuitBreaker.execute(async () => {
      // Re-verify cache inside circuit breaker block
      if (this.paymentCache.has(key)) {
        return { ...this.paymentCache.get(key)!, isDuplicate: true };
      }
      if (this.gatewayLedger.has(key)) {
        const existing = this.gatewayLedger.get(key)!;
        this.paymentCache.set(key, existing);
        return { ...existing, isDuplicate: true };
      }

      // Inject Chaos Faults if configured
      await chaosInjector.injectFault('Payment Gateway');

      // Generate stable deterministic transaction ID based on orderId
      const txnId = `TXN-${orderId}`;
      const result: PaymentResult = {
        success: true,
        txnId,
        amount,
        idempotencyKey: key
      };

      // Provider processes payment and durably records it in provider ledger
      this.gatewayLedger.set(key, result);

      // Check if network response should be lost on 1st attempt
      if (this.lostResponseKeys.has(key)) {
        this.lostResponseKeys.delete(key);
        throw new Error('Gateway Timeout: Response lost after processing payment');
      }

      this.paymentCache.set(key, result);
      return result;
    });
  }

  async refundPayment(orderId: string, txnId: string, amount: number): Promise<void> {
    console.log(`[PaymentService] Refunded $${amount} for Order ${orderId} (Txn: ${txnId})`);
  }

  clearCache(): void {
    this.paymentCache.clear();
    this.gatewayLedger.clear();
    this.lostResponseKeys.clear();
  }
}

export const paymentService = new PaymentService();
