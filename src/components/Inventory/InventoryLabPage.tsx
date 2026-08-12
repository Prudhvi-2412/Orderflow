import React, { useState, useEffect } from 'react';
import { Package, ShieldCheck, Zap } from 'lucide-react';
import { globalChaosEngine } from '../../simulator/ChaosEngine.js';
import { globalInventoryService } from '../../services/InventoryService.js';
import { globalLockManager } from '../../core/LockManager.js';
import { HeaderBanner } from '../Common/HeaderBanner.js';
import { FlashSaleForm } from '../Concurrency/FlashSaleForm.js';
import { FlashSaleResults } from '../Concurrency/FlashSaleResults.js';

export function InventoryLabPage() {
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
        icon={Package}
        tag="Inventory Correctness & Locking Control"
        title="Inventory Lab — Race Condition & Lock Contention Benchmark"
        description="Demonstrating how PostgreSQL concurrency control, Optimistic CAS, and Pessimistic Redlock Mutex prevent inventory overselling during concurrent flash-sale requests."
        color="amber"
      />

      {/* Main Form and Execution Results */}
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

      {/* Strategy Comparison Matrix Table */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-2 flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-emerald-600" />
          Concurrency Lock Strategy Performance Comparison
        </h3>
        <p className="text-xs text-slate-500 mb-4">
          Comparative breakdown of inventory safety and latency across locking strategies under high traffic contention.
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 text-[11px] bg-slate-50">
                <th className="p-3">Locking Strategy</th>
                <th className="p-3">Data Safety</th>
                <th className="p-3">Success Rate</th>
                <th className="p-3">Rejected Requests</th>
                <th className="p-3">Oversold Risk</th>
                <th className="p-3 text-right">Avg Latency</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              <tr className="hover:bg-slate-50">
                <td className="p-3 font-bold text-rose-700">NONE (Unsafe Raw Reads)</td>
                <td className="p-3 text-rose-700 font-bold">❌ UNSAFE</td>
                <td className="p-3 font-bold text-slate-900">100% (Blind Writes)</td>
                <td className="p-3 text-slate-500">0</td>
                <td className="p-3 font-extrabold text-rose-600">HIGH (Negative Stock)</td>
                <td className="p-3 text-right font-bold text-emerald-700">~2 ms</td>
              </tr>
              <tr className="hover:bg-slate-50">
                <td className="p-3 font-bold text-amber-700">OPTIMISTIC (Version CAS)</td>
                <td className="p-3 text-emerald-700 font-bold">✓ SAFE</td>
                <td className="p-3 font-bold text-slate-900">Exact Stock Qty</td>
                <td className="p-3 text-slate-500">Retried / Aborted</td>
                <td className="p-3 font-bold text-emerald-700">ZERO (0 Oversold)</td>
                <td className="p-3 text-right font-bold text-amber-700">~12 ms</td>
              </tr>
              <tr className="hover:bg-slate-50 bg-blue-50/40">
                <td className="p-3 font-bold text-blue-700">PESSIMISTIC (Redlock Mutex)</td>
                <td className="p-3 text-emerald-700 font-bold">✓ SAFE (Guaranteed)</td>
                <td className="p-3 font-bold text-slate-900">Exact Stock Qty</td>
                <td className="p-3 text-slate-500">Queued / Lock Rejections</td>
                <td className="p-3 font-bold text-emerald-700">ZERO (0 Oversold)</td>
                <td className="p-3 text-right font-bold text-indigo-700">~24 ms</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default InventoryLabPage;
