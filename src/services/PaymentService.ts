import { CircuitBreaker } from '../core/CircuitBreaker.js';
import { globalEventBus } from '../core/EventBus.js';
import { globalMetrics } from '../core/MetricsEngine.js';

export interface ChaosConfig {
  failureRate?: number;
  latencyMs?: number;
  forceOutage?: boolean;
}

export interface PaymentTransaction {
  txnId: string;
  orderId: string;
  amount: number;
  customerEmail: string;
  status: 'SETTLED' | 'REFUNDED';
  timestamp: number;
}

export class PaymentService {
  public circuitBreaker: CircuitBreaker;
  public chaos = {
    failureRate: 0,
    latencyMs: 100,
    forceOutage: false
  };

  private transactions = new Map<string, PaymentTransaction>();

  constructor() {
    this.circuitBreaker = new CircuitBreaker('PaymentGateway', {
      failureThreshold: 3,
      resetTimeoutMs: 5000,
      successThreshold: 2
    });
  }

  setChaosConfig(config: ChaosConfig): void {
    this.chaos = { ...this.chaos, ...config };
  }

  async processPayment(orderId: string, amount: number, customerEmail = 'customer@example.com'): Promise<PaymentTransaction> {
    const startTime = Date.now();

    return await this.circuitBreaker.execute(
      async () => {
        if (this.chaos.forceOutage) {
          throw new Error('503 Service Unavailable: Payment Gateway is offline for emergency maintenance.');
        }

        if (this.chaos.latencyMs > 0) {
          await new Promise((r) => setTimeout(r, this.chaos.latencyMs));
        }

        if (this.chaos.failureRate > 0) {
          const rand = Math.random() * 100;
          if (rand < this.chaos.failureRate) {
            throw new Error(`500 PaymentGatewayError: Gateway timeout / card decline simulation (Chaos rate: ${this.chaos.failureRate}%).`);
          }
        }

        const txnId = `txn_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
        const txnDetails: PaymentTransaction = {
          txnId,
          orderId,
          amount,
          customerEmail,
          status: 'SETTLED',
          timestamp: Date.now()
        };

        this.transactions.set(txnId, txnDetails);
        globalMetrics.record('PaymentService', Date.now() - startTime, true);

        return txnDetails;
      },
      async (error: Error) => {
        globalMetrics.record('PaymentService', Date.now() - startTime, false);
        throw new Error(`PaymentFailed: ${error.message}`);
      }
    );
  }

  async refundPayment(orderId: string, txnId: string, amount: number): Promise<{ refundId: string; txnId: string; status: string }> {
    const startTime = Date.now();
    try {
      const refundId = `ref_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
      const existing = this.transactions.get(txnId);
      if (existing) {
        existing.status = 'REFUNDED';
      }

      await globalEventBus.publish('PaymentRefunded', {
        orderId,
        txnId,
        refundId,
        amountRefunded: amount,
        timestamp: Date.now()
      });

      globalMetrics.record('PaymentService', Date.now() - startTime, true);
      return { refundId, txnId, status: 'REFUNDED' };
    } catch (err) {
      globalMetrics.record('PaymentService', Date.now() - startTime, false);
      throw err;
    }
  }
}

export const globalPaymentService = new PaymentService();
