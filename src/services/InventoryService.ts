import { globalLockManager } from '../core/LockManager.js';
import { globalEventBus } from '../core/EventBus.js';
import { globalMetrics } from '../core/MetricsEngine.js';

export interface InventoryItem {
  id: string;
  name: string;
  stock: number;
  version: number;
  reserved: number;
}

export interface StockReservationResult {
  success: boolean;
  sku: string;
  reservedQty: number;
  remainingStock: number;
  version: number;
  fenceToken?: number;
}

export class InventoryService {
  private stockMap = new Map<string, InventoryItem>([
    ['ITEM-IPHONE-15', { id: 'ITEM-IPHONE-15', name: 'iPhone 15 Pro Flash Sale', stock: 10, version: 1, reserved: 0 }],
    ['ITEM-GPU-4090', { id: 'ITEM-GPU-4090', name: 'RTX 4090 Founder Edition', stock: 5, version: 1, reserved: 0 }],
    ['ITEM-TICKET-CONCERT', { id: 'ITEM-TICKET-CONCERT', name: 'VIP Concert Front Row Ticket', stock: 3, version: 1, reserved: 0 }]
  ]);

  public oversellCount = 0;

  getItem(sku: string): InventoryItem | null {
    return this.stockMap.get(sku) || null;
  }

  getAllItems(): InventoryItem[] {
    return Array.from(this.stockMap.values());
  }

  resetStock(sku: string, amount = 10): void {
    const item = this.stockMap.get(sku);
    if (item) {
      item.stock = amount;
      item.version = 1;
      item.reserved = 0;
    }
    this.oversellCount = 0;
  }

  async reserveStock(
    sku: string,
    quantity = 1,
    orderId = 'ord_demo',
    lockStrategy: 'NONE' | 'OPTIMISTIC' | 'PESSIMISTIC' = 'PESSIMISTIC'
  ): Promise<StockReservationResult> {
    const startTime = Date.now();
    const item = this.stockMap.get(sku);

    if (!item) {
      throw new Error(`InventoryError: Product ${sku} not found`);
    }

    try {
      if (lockStrategy === 'NONE') {
        const currentStock = item.stock;
        await new Promise((r) => setTimeout(r, Math.floor(Math.random() * 15) + 5));

        if (currentStock >= quantity) {
          item.stock = item.stock - quantity;
          item.reserved += quantity;

          if (item.stock < 0) {
            this.oversellCount++;
          }

          globalMetrics.record('InventoryService', Date.now() - startTime, true);
          return { success: true, sku, reservedQty: quantity, remainingStock: item.stock, version: item.version };
        } else {
          globalMetrics.record('InventoryService', Date.now() - startTime, false);
          throw new Error(`InsufficientStock: Stock depleted for ${sku}`);
        }
      } else if (lockStrategy === 'OPTIMISTIC') {
        const expectedVersion = item.version;
        const currentStock = item.stock;

        await new Promise((r) => setTimeout(r, Math.floor(Math.random() * 10) + 5));

        if (currentStock < quantity) {
          globalMetrics.record('InventoryService', Date.now() - startTime, false);
          throw new Error(`InsufficientStock: Stock depleted for ${sku}`);
        }

        if (item.version !== expectedVersion) {
          globalMetrics.record('InventoryService', Date.now() - startTime, false);
          throw new Error(
            `OptimisticLockException: Concurrent update detected on ${sku}. Expected version v${expectedVersion}, found v${item.version}.`
          );
        }

        item.stock -= quantity;
        item.reserved += quantity;
        item.version += 1;

        globalMetrics.record('InventoryService', Date.now() - startTime, true);
        return { success: true, sku, reservedQty: quantity, remainingStock: item.stock, version: item.version };
      } else {
        const resourceKey = `lock:inventory:${sku}`;
        const ownerId = `worker_${orderId}`;

        const lock = await globalLockManager.acquireWithRetry(resourceKey, ownerId, 3000, 15, 20);

        if (!lock) {
          globalMetrics.record('InventoryService', Date.now() - startTime, false);
          throw new Error(`LockAcquisitionTimeout: Failed to acquire distributed lock for resource [${resourceKey}]`);
        }

        try {
          if (item.stock < quantity) {
            throw new Error(`InsufficientStock: Stock depleted for ${sku}`);
          }

          item.stock -= quantity;
          item.reserved += quantity;
          item.version += 1;

          globalMetrics.record('InventoryService', Date.now() - startTime, true);
          return {
            success: true,
            sku,
            reservedQty: quantity,
            remainingStock: item.stock,
            version: item.version,
            fenceToken: lock.fenceToken
          };
        } finally {
          await globalLockManager.release(resourceKey, ownerId);
        }
      }
    } catch (err) {
      globalMetrics.record('InventoryService', Date.now() - startTime, false);
      throw err;
    }
  }

  async releaseStock(sku: string, quantity = 1, orderId = 'ord_demo'): Promise<boolean> {
    const item = this.stockMap.get(sku);
    if (!item) return false;

    const resourceKey = `lock:inventory:${sku}`;
    const ownerId = `rollback_${orderId}`;

    const lock = await globalLockManager.acquireWithRetry(resourceKey, ownerId, 3000, 10, 20);

    try {
      item.stock += quantity;
      item.reserved = Math.max(0, item.reserved - quantity);
      item.version += 1;

      await globalEventBus.publish('InventoryReleased', {
        sku,
        quantityReleased: quantity,
        orderId,
        newStock: item.stock
      });
      return true;
    } finally {
      if (lock) {
        await globalLockManager.release(resourceKey, ownerId);
      }
    }
  }
}

export const globalInventoryService = new InventoryService();
