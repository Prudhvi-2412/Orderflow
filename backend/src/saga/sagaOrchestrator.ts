import { pool } from '../config/db.js';
import { inventoryService } from '../services/inventoryService.js';
import { paymentService } from '../services/paymentService.js';
import { kafkaProducer } from '../kafka/producer.js';
import { KAFKA_TOPICS } from '../kafka/topics.js';

export interface SagaState {
  orderId: string;
  sku: string;
  quantity: number;
  totalAmount: number;
  customerEmail: string;
  lockStrategy: 'PESSIMISTIC' | 'OPTIMISTIC' | 'NONE';
  status: 'PROCESSING' | 'COMPLETED' | 'CANCELLED' | 'FAILED';
  currentStep: string;
  errorReason?: string;
}

export class SagaOrchestrator {
  
  /**
   * Execute Saga Transaction Workflow
   */
  async executeSaga(orderId: string, sku: string, quantity: number, price: number, customerEmail: string, lockStrategy: 'PESSIMISTIC' | 'OPTIMISTIC' | 'NONE' = 'PESSIMISTIC'): Promise<SagaState> {
    const totalAmount = price * quantity;

    console.log(`🔄 [Saga Orchestrator] Starting Saga Workflow for Order ${orderId}...`);

    // --- STEP 1: RESERVE INVENTORY ---
    await this.updateSagaStatus(orderId, 'PROCESSING', 'INVENTORY_RESERVATION');

    const reservation = await inventoryService.reserveStock(null, sku, quantity, lockStrategy);

    if (!reservation.success) {
      console.error(`❌ [Saga Orchestrator] Step 1 Failed: Inventory reservation failed for ${orderId}.`);
      await this.updateSagaStatus(orderId, 'FAILED', 'INVENTORY_FAILED', reservation.error);
      
      await kafkaProducer.publish(KAFKA_TOPICS.ORDERS_CANCELLED, orderId, {
        orderId,
        reason: reservation.error
      });

      return {
        orderId,
        sku,
        quantity,
        totalAmount,
        customerEmail,
        lockStrategy,
        status: 'FAILED',
        currentStep: 'INVENTORY_FAILED',
        errorReason: reservation.error
      };
    }

    // Publish InventoryReserved Event
    await kafkaProducer.publish(KAFKA_TOPICS.INVENTORY_RESERVED, orderId, {
      orderId,
      sku,
      quantity,
      remainingStock: reservation.remainingStock
    });

    // --- STEP 2: PROCESS PAYMENT ---
    await this.updateSagaStatus(orderId, 'PROCESSING', 'PAYMENT_PROCESSING');

    try {
      const paymentResult = await paymentService.processPayment(orderId, totalAmount, customerEmail);

      // Record Payment in DB
      await pool.query(
        `INSERT INTO payments (order_id, txn_id, amount, status)
         VALUES ($1, $2, $3, 'SUCCESS')`,
        [orderId, paymentResult.txnId, totalAmount]
      );

      // Publish PaymentCompleted Event
      await kafkaProducer.publish(KAFKA_TOPICS.PAYMENT_COMPLETED, orderId, {
        orderId,
        txnId: paymentResult.txnId,
        amount: totalAmount
      });

      // --- STEP 3: SAGA SUCCESS & CONFIRM ORDER ---
      await this.updateSagaStatus(orderId, 'COMPLETED', 'CONFIRMED');

      await kafkaProducer.publish(KAFKA_TOPICS.ORDERS_CONFIRMED, orderId, {
        orderId,
        sku,
        quantity,
        totalAmount,
        txnId: paymentResult.txnId
      });

      console.log(`✅ [Saga Orchestrator] Saga Completed Successfully for Order ${orderId}.`);

      return {
        orderId,
        sku,
        quantity,
        totalAmount,
        customerEmail,
        lockStrategy,
        status: 'COMPLETED',
        currentStep: 'CONFIRMED'
      };

    } catch (paymentErr: any) {
      // --- SAGA COMPENSATING ROLLBACK WORKFLOW ---
      console.warn(`⚠️ [Saga Orchestrator] Payment Failed for ${orderId}. Executing Compensating Rollback...`);
      
      await this.updateSagaStatus(orderId, 'PROCESSING', 'COMPENSATING_ROLLBACK', `Payment Error: ${paymentErr.message}`);

      // Publish PaymentFailed Event
      await kafkaProducer.publish(KAFKA_TOPICS.PAYMENT_FAILED, orderId, {
        orderId,
        reason: paymentErr.message
      });

      // Compensation 1: Release Reserved Inventory
      console.log(`🔄 [Saga Compensation] Releasing ${quantity} units of ${sku} for Order ${orderId}...`);
      await inventoryService.releaseStock(sku, quantity);

      await kafkaProducer.publish(KAFKA_TOPICS.INVENTORY_RELEASED, orderId, {
        orderId,
        sku,
        quantityReleased: quantity
      });

      // Finalize Saga Cancellation
      await this.updateSagaStatus(orderId, 'CANCELLED', 'CANCELLED', `Payment Error: ${paymentErr.message}`);

      await kafkaProducer.publish(KAFKA_TOPICS.ORDERS_CANCELLED, orderId, {
        orderId,
        reason: `Payment Error: ${paymentErr.message}`,
        compensated: true
      });

      console.log(`🛑 [Saga Orchestrator] Saga Compensation Complete. Order ${orderId} status set to CANCELLED.`);

      return {
        orderId,
        sku,
        quantity,
        totalAmount,
        customerEmail,
        lockStrategy,
        status: 'CANCELLED',
        currentStep: 'CANCELLED',
        errorReason: paymentErr.message
      };
    }
  }

  private async updateSagaStatus(orderId: string, status: string, step: string, errorReason?: string): Promise<void> {
    await pool.query(
      `UPDATE orders 
       SET status = $1, error_reason = $2, updated_at = NOW() 
       WHERE order_id = $3`,
      [status, errorReason || null, orderId]
    );
  }
}

export const sagaOrchestrator = new SagaOrchestrator();
