import React, { useState, useEffect } from 'react';
import { Flame } from 'lucide-react';
import { globalChaosEngine } from '../simulator/ChaosEngine.js';
import { globalInventoryService } from '../services/InventoryService.js';
import { globalLockManager } from '../core/LockManager.js';
import { HeaderBanner } from './Common/HeaderBanner.js';
import { FlashSaleForm } from './Concurrency/FlashSaleForm.js';
import { FlashSaleResults } from './Concurrency/FlashSaleResults.js';

export function ConcurrencyTester() {
  const [sku, setSku] = useState('ITEM-IPHONE-15');
  const [stockQty, setStockQty] = useState(5);
  const [concurrentUsers, setConcurrentUsers] = useState(25);
  const [lockStrategy, setLockStrategy] = useState<'NONE' | 'OPTIMISTIC' | 'PESSIMISTIC'>('PESSIMISTIC');

  const [isSimulating, setIsSimulating] = useState(false);
  const [progress, setProgress] = useState({ completed: 0, total: 0 });
  const [lastResults, setLastResults] = useState<any>(null);

  const items = globalInventoryService.getAllItems();
  const currentItem = globalInventoryService.getItem(sku);

  useEffect(() => {
    const unsub = globalChaosEngine.onProgress((evt: any) => {
      if (evt.type === 'BENCHMARK_PROGRESS') {
        setProgress({ completed: evt.completed, total: evt.total });
      } else if (evt.type === 'BENCHMARK_COMPLETE') {
        setIsSimulating(false);
        setLastResults(evt.results);
      }
    });

    return () => unsub();
  }, []);

  const handleRunBenchmark = async () => {
    setIsSimulating(true);
    setLastResults(null);
    setProgress({ completed: 0, total: concurrentUsers });

    await globalChaosEngine.runFlashSaleSimulation({
      sku,
      stockQty: Number(stockQty),
      concurrentUsers: Number(concurrentUsers),
      lockStrategy
    });
  };

  const handleResetStock = () => {
    globalInventoryService.resetStock(sku, Number(stockQty));
    setLastResults(null);
  };

  return (
    <div className="space-y-6">
      <HeaderBanner
        icon={Flame}
        tag="High-Concurrency Stress Testing Lab"
        title="Race Condition & Lock Contention Benchmark"
        description="Simulate flash-sale traffic spikes with dozens of concurrent threads attempting to reserve limited inventory items simultaneously. Compare data integrity under No Locks vs Optimistic CAS vs Pessimistic Distributed Mutex."
        color="amber"
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <FlashSaleForm
          items={items}
          sku={sku}
          setSku={setSku}
          stockQty={stockQty}
          setStockQty={setStockQty}
          concurrentUsers={concurrentUsers}
          setConcurrentUsers={setConcurrentUsers}
          lockStrategy={lockStrategy}
          setLockStrategy={setLockStrategy}
          isSimulating={isSimulating}
          progress={progress}
          onRun={handleRunBenchmark}
          onReset={handleResetStock}
        />

        <FlashSaleResults
          currentItem={currentItem}
          lastResults={lastResults}
          isSimulating={isSimulating}
          progress={progress}
          contentionCount={globalLockManager.contentionCount}
        />
      </div>
    </div>
  );
}

export default ConcurrencyTester;
