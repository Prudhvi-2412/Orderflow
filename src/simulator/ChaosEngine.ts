import { globalOrderService } from '../services/OrderService.js';
import { globalInventoryService } from '../services/InventoryService.js';
import { globalLockManager } from '../core/LockManager.js';

export interface FlashSaleSimulationOpts {
  sku?: string;
  stockQty?: number;
  concurrentUsers?: number;
  lockStrategy?: 'NONE' | 'OPTIMISTIC' | 'PESSIMISTIC';
}

export interface BenchmarkResults {
  sku: string;
  initialStock: number;
  concurrentRequests: number;
  lockStrategy: string;
  successes: number;
  failures: number;
  lockCollisions: number;
  oversoldUnits: number;
  finalStock: number;
  durationMs: number;
  responses: any[];
}

export class ChaosEngine {
  public isRunningTest = false;
  private listeners: ((event: any) => void)[] = [];

  onProgress(listener: (event: any) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  async runFlashSaleSimulation(opts: FlashSaleSimulationOpts = {}): Promise<BenchmarkResults | undefined> {
    if (this.isRunningTest) return;
    this.isRunningTest = true;

    const {
      sku = 'ITEM-IPHONE-15',
      stockQty = 10,
      concurrentUsers = 25,
      lockStrategy = 'PESSIMISTIC'
    } = opts;

    globalInventoryService.resetStock(sku, stockQty);

    this._notify({ type: 'BENCHMARK_START', total: concurrentUsers, lockStrategy });

    const results: BenchmarkResults = {
      sku,
      initialStock: stockQty,
      concurrentRequests: concurrentUsers,
      lockStrategy,
      successes: 0,
      failures: 0,
      lockCollisions: 0,
      oversoldUnits: 0,
      finalStock: 0,
      durationMs: 0,
      responses: []
    };

    const startTime = Date.now();

    const promises = Array.from({ length: concurrentUsers }).map(async (_, index) => {
      const idempotencyKey = `flash_sale_usr_${index}_${Date.now()}`;
      try {
        const orderResult = await globalOrderService.submitOrder({
          sku,
          quantity: 1,
          price: 999,
          idempotencyKey,
          lockStrategy,
          customerEmail: `user_${index}@flashsale.com`
        });

        if (orderResult.status === 'COMPLETED') {
          results.successes++;
        } else {
          results.failures++;
        }
        results.responses.push({ userId: index, status: orderResult.status, orderId: orderResult.orderId });
      } catch (err: any) {
        results.failures++;
        results.responses.push({ userId: index, status: 'ERROR', error: err.message });
      }

      this._notify({
        type: 'BENCHMARK_PROGRESS',
        completed: results.successes + results.failures,
        total: concurrentUsers,
        currentResults: { ...results }
      });
    });

    await Promise.all(promises);

    results.durationMs = Date.now() - startTime;
    const finalItem = globalInventoryService.getItem(sku);
    results.finalStock = finalItem ? finalItem.stock : 0;
    results.oversoldUnits = globalInventoryService.oversellCount;
    results.lockCollisions = globalLockManager.contentionCount;

    this.isRunningTest = false;
    this._notify({ type: 'BENCHMARK_COMPLETE', results });

    return results;
  }

  async runIdempotencyTest(repeatCount = 5): Promise<any> {
    if (this.isRunningTest) return;
    this.isRunningTest = true;

    const idempotencyKey = `idemp_duplicate_test_${Date.now()}`;
    const payload = { sku: 'ITEM-GPU-4090', quantity: 1, price: 1599 };

    const results = {
      key: idempotencyKey,
      totalSubmissions: repeatCount,
      cacheHits: 0,
      actualExecutions: 0,
      responses: [] as any[]
    };

    const promises = Array.from({ length: repeatCount }).map(async (_, index) => {
      await new Promise((r) => setTimeout(r, index * 15));
      try {
        const res = await globalOrderService.submitOrder({
          ...payload,
          idempotencyKey,
          lockStrategy: 'PESSIMISTIC'
        });

        if (res._idempotentCacheHit) {
          results.cacheHits++;
        } else {
          results.actualExecutions++;
        }
        results.responses.push({ index, status: res.status, cacheHit: !!res._idempotentCacheHit, orderId: res.orderId });
      } catch (err: any) {
        results.responses.push({ index, status: 'REJECTED', error: err.message });
      }
    });

    await Promise.all(promises);

    this.isRunningTest = false;
    this._notify({ type: 'IDEMPOTENCY_TEST_COMPLETE', results });
    return results;
  }

  private _notify(event: any): void {
    this.listeners.forEach((l) => {
      try {
        l(event);
      } catch (e) {}
    });
  }
}

export const globalChaosEngine = new ChaosEngine();
