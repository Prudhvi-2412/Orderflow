import { globalEventBus } from '../core/EventBus.js';
import { globalIdempotencyManager } from '../core/IdempotencyManager.js';
import { globalInventoryService } from './InventoryService.js';
import { globalPaymentService } from './PaymentService.js';
import { globalShippingService } from './ShippingService.js';
import { globalMetrics } from '../core/MetricsEngine.js';

export interface SagaStep {
  name: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  timestamp: number | null;
  error?: string;
}

export interface SagaState {
  orderId: string;
  idempotencyKey: string;
  sku: string;
  quantity: number;
  totalAmount: number;
  customerEmail: string;
  lockStrategy: 'NONE' | 'OPTIMISTIC' | 'PESSIMISTIC';
  status: 'PROCESSING' | 'COMPLETED' | 'CANCELLED' | 'FAILED';
  currentStep: string;
  steps: SagaStep[];
  inventoryReserved: boolean;
  paymentResult: any | null;
  shippingInfo: any | null;
  errorReason: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface OrderRequest {
  sku?: string;
  quantity?: number;
  price?: number;
  idempotencyKey?: string;
  lockStrategy?: 'NONE' | 'OPTIMISTIC' | 'PESSIMISTIC';
  customerEmail?: string;
}

export class OrderService {
  private orders = new Map<string, SagaState>();
  private listeners: ((state: SagaState) => void)[] = [];

  onOrderChange(listener: (state: SagaState) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  getOrder(orderId: string): SagaState | null {
    return this.orders.get(orderId) || null;
  }

  getAllOrders(): SagaState[] {
    return Array.from(this.orders.values()).sort((a, b) => b.createdAt - a.createdAt);
  }

  async submitOrder(orderRequest: OrderRequest): Promise<any> {
    const startTime = Date.now();
    const {
      sku = 'ITEM-IPHONE-15',
      quantity = 1,
      price = 999,
      idempotencyKey = `idemp_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      lockStrategy = 'PESSIMISTIC',
      customerEmail = 'alex.dev@example.com'
    } = orderRequest;

    const payload = { sku, quantity, price, customerEmail };

    const idempResult = globalIdempotencyManager.begin(idempotencyKey, payload);

    if (idempResult.action === 'SERVE_CACHE') {
      return {
        ...idempResult.response,
        _idempotentCacheHit: true,
        _cachedAt: idempResult.cachedAt
      };
    }

    if (idempResult.action === 'IN_PROGRESS' || idempResult.action === 'PAYLOAD_MISMATCH') {
      throw new Error(idempResult.error);
    }

    const orderId = `ORD-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const totalAmount = price * quantity;

    const sagaState: SagaState = {
      orderId,
      idempotencyKey,
      sku,
      quantity,
      totalAmount,
      customerEmail,
      lockStrategy,
      status: 'PROCESSING',
      currentStep: 'ORDER_CREATED',
      steps: [
        { name: 'Order Validation', status: 'COMPLETED', timestamp: Date.now() },
        { name: 'Inventory Reservation', status: 'PENDING', timestamp: null },
        { name: 'Payment Processing', status: 'PENDING', timestamp: null },
        { name: 'Fulfillment & Shipping', status: 'PENDING', timestamp: null }
      ],
      inventoryReserved: false,
      paymentResult: null,
      shippingInfo: null,
      errorReason: null,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    this.orders.set(orderId, sagaState);
    this._notifySagaUpdate(sagaState);

    await globalEventBus.publish('OrderCreated', { orderId, sagaState }, { sagaId: orderId });

    try {
      sagaState.currentStep = 'INVENTORY_RESERVATION';
      sagaState.steps[1].status = 'IN_PROGRESS';
      sagaState.steps[1].timestamp = Date.now();
      this._notifySagaUpdate(sagaState);

      const reservation = await globalInventoryService.reserveStock(sku, quantity, orderId, lockStrategy);
      sagaState.inventoryReserved = true;
      sagaState.steps[1].status = 'COMPLETED';
      this._notifySagaUpdate(sagaState);

      await globalEventBus.publish('InventoryReserved', { orderId, sku, quantity, reservation }, { sagaId: orderId });

      sagaState.currentStep = 'PAYMENT_PROCESSING';
      sagaState.steps[2].status = 'IN_PROGRESS';
      sagaState.steps[2].timestamp = Date.now();
      this._notifySagaUpdate(sagaState);

      let paymentResult: any;
      try {
        paymentResult = await globalPaymentService.processPayment(orderId, totalAmount, customerEmail);
        sagaState.paymentResult = paymentResult;
        sagaState.steps[2].status = 'COMPLETED';
        this._notifySagaUpdate(sagaState);

        await globalEventBus.publish('PaymentProcessed', { orderId, paymentResult }, { sagaId: orderId });
      } catch (paymentErr: any) {
        sagaState.steps[2].status = 'FAILED';
        sagaState.steps[2].error = paymentErr.message;
        sagaState.status = 'CANCELLED';
        sagaState.errorReason = `Payment Error: ${paymentErr.message}`;
        this._notifySagaUpdate(sagaState);

        await globalEventBus.publish('PaymentFailed', { orderId, error: paymentErr.message }, { sagaId: orderId });

        await globalInventoryService.releaseStock(sku, quantity, orderId);

        globalIdempotencyManager.fail(idempotencyKey, paymentErr.message);
        globalMetrics.record('OrderService', Date.now() - startTime, false);

        await globalEventBus.publish('OrderFailed', { orderId, reason: sagaState.errorReason }, { sagaId: orderId });
        return sagaState;
      }

      sagaState.currentStep = 'SHIPPING';
      sagaState.steps[3].status = 'IN_PROGRESS';
      sagaState.steps[3].timestamp = Date.now();
      this._notifySagaUpdate(sagaState);

      try {
        const shippingInfo = await globalShippingService.scheduleShipment(orderId, [{ sku, quantity }]);
        sagaState.shippingInfo = shippingInfo;
        sagaState.steps[3].status = 'COMPLETED';
        this._notifySagaUpdate(sagaState);

        await globalEventBus.publish('ShippingScheduled', { orderId, shippingInfo }, { sagaId: orderId });
      } catch (shippingErr: any) {
        sagaState.steps[3].status = 'FAILED';
        sagaState.steps[3].error = shippingErr.message;
        sagaState.status = 'CANCELLED';
        sagaState.errorReason = `Shipping Error: ${shippingErr.message}`;
        this._notifySagaUpdate(sagaState);

        if (sagaState.paymentResult?.txnId) {
          await globalPaymentService.refundPayment(orderId, sagaState.paymentResult.txnId, totalAmount);
        }

        await globalInventoryService.releaseStock(sku, quantity, orderId);

        globalIdempotencyManager.fail(idempotencyKey, shippingErr.message);
        globalMetrics.record('OrderService', Date.now() - startTime, false);

        await globalEventBus.publish('OrderFailed', { orderId, reason: sagaState.errorReason }, { sagaId: orderId });
        return sagaState;
      }

      sagaState.status = 'COMPLETED';
      sagaState.currentStep = 'FINISHED';
      sagaState.updatedAt = Date.now();
      this._notifySagaUpdate(sagaState);

      const finalResponse = {
        orderId: sagaState.orderId,
        status: sagaState.status,
        sku: sagaState.sku,
        quantity: sagaState.quantity,
        totalAmount: sagaState.totalAmount,
        txnId: sagaState.paymentResult?.txnId,
        trackingNumber: sagaState.shippingInfo?.trackingNumber,
        createdAt: sagaState.createdAt
      };

      globalIdempotencyManager.complete(idempotencyKey, finalResponse);
      globalMetrics.record('OrderService', Date.now() - startTime, true);

      await globalEventBus.publish('OrderCompleted', { orderId, ...finalResponse }, { sagaId: orderId });
      return sagaState;
    } catch (err: any) {
      sagaState.status = 'FAILED';
      sagaState.errorReason = err.message;
      this._notifySagaUpdate(sagaState);
      globalIdempotencyManager.fail(idempotencyKey, err.message);
      globalMetrics.record('OrderService', Date.now() - startTime, false);
      await globalEventBus.publish('OrderFailed', { orderId, reason: err.message }, { sagaId: orderId });
      return sagaState;
    }
  }

  private _notifySagaUpdate(sagaState: SagaState): void {
    this.listeners.forEach((l) => {
      try {
        l(sagaState);
      } catch (e) {}
    });
  }

  clearAllOrders(): void {
    this.orders.clear();
  }
}

export const globalOrderService = new OrderService();
