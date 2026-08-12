import { CircuitBreaker } from '../resilience/circuitBreaker.js';
import { chaosInjector } from '../resilience/chaosInjector.js';

export interface PaymentResult {
  success: boolean;
  txnId: string;
  amount: number;
  error?: string;
}

export class PaymentService {
  public circuitBreaker: CircuitBreaker;

  constructor() {
    this.circuitBreaker = new CircuitBreaker({
      name: 'PaymentGatewayCircuitBreaker',
      failureThreshold: 3,
      resetTimeoutMs: 2000, // 2s reset timer for testing
      halfOpenSuccesses: 2
    });
  }

  setChaos(failureRate: number, forceOutage: boolean) {
    chaosInjector.setChaos({ failureRate, forceOutage });
  }

  async processPayment(orderId: string, amount: number, customerEmail: string): Promise<PaymentResult> {
    return await this.circuitBreaker.execute(async () => {
      // 1. Inject Chaos Faults if active
      await chaosInjector.injectFault('Payment Gateway');

      // 2. Process Normal Settlement
      const txnId = `TXN-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
      return {
        success: true,
        txnId,
        amount
      };
    });
  }

  async refundPayment(orderId: string, txnId: string, amount: number): Promise<void> {
    console.log(`[PaymentService] Refunded $${amount} for Order ${orderId} (Txn: ${txnId})`);
  }
}

export const paymentService = new PaymentService();
