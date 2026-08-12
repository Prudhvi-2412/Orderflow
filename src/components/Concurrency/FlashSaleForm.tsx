import React from 'react';
import { Sliders, RotateCcw, Play, Zap } from 'lucide-react';
import { LockStrategySelector } from './LockStrategySelector.js';

export interface FlashSaleFormProps {
  items: any[];
  sku: string;
  setSku: (sku: string) => void;
  stockQty: number;
  setStockQty: (qty: number) => void;
  concurrentUsers: number;
  setConcurrentUsers: (users: number) => void;
  lockStrategy: 'NONE' | 'OPTIMISTIC' | 'PESSIMISTIC';
  setLockStrategy: (strategy: 'NONE' | 'OPTIMISTIC' | 'PESSIMISTIC') => void;
  isSimulating: boolean;
  progress: { completed: number; total: number };
  onRun: () => void;
  onReset: () => void;
}

export function FlashSaleForm({
  items,
  sku,
  setSku,
  stockQty,
  setStockQty,
  concurrentUsers,
  setConcurrentUsers,
  lockStrategy,
  setLockStrategy,
  isSimulating,
  progress,
  onRun,
  onReset
}: FlashSaleFormProps) {
  return (
    <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-6 space-y-6 shadow-xs">
      <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center justify-between">
        <span className="flex items-center gap-2">
          <Sliders className="h-4 w-4 text-blue-600" />
          Flash Sale Parameters
        </span>
        <button
          onClick={onReset}
          className="text-xs text-slate-500 hover:text-blue-600 flex items-center gap-1 transition font-medium"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Reset Stock
        </button>
      </h3>

      <div>
        <label className="block text-xs font-semibold text-slate-700 mb-2">Target Flash Sale Item</label>
        <select
          value={sku}
          onChange={(e) => setSku(e.target.value)}
          className="w-full input-enterprise px-3 py-2 text-xs font-medium"
        >
          {items.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name} (Available Stock: {item.stock})
            </option>
          ))}
        </select>
      </div>

      <div>
        <div className="flex justify-between items-center text-xs font-semibold text-slate-700 mb-2">
          <span>Initial Inventory Stock</span>
          <span className="font-mono text-blue-700 font-bold">{stockQty} units</span>
        </div>
        <input
          type="range"
          min="1"
          max="20"
          value={stockQty}
          onChange={(e) => setStockQty(Number(e.target.value))}
          className="w-full accent-blue-600 bg-slate-200 rounded-lg cursor-pointer"
        />
      </div>

      <div>
        <div className="flex justify-between items-center text-xs font-semibold text-slate-700 mb-2">
          <span>Concurrent User Threads</span>
          <span className="font-mono text-indigo-700 font-bold">{concurrentUsers} requests</span>
        </div>
        <input
          type="range"
          min="5"
          max="60"
          step="5"
          value={concurrentUsers}
          onChange={(e) => setConcurrentUsers(Number(e.target.value))}
          className="w-full accent-indigo-600 bg-slate-200 rounded-lg cursor-pointer"
        />
      </div>

      <LockStrategySelector selectedStrategy={lockStrategy} onChangeStrategy={setLockStrategy} />

      <button
        onClick={onRun}
        disabled={isSimulating}
        className={`w-full py-3 rounded-xl font-bold text-xs transition flex items-center justify-center space-x-2 shadow-sm ${
          isSimulating
            ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
            : 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-500/20'
        }`}
      >
        {isSimulating ? (
          <>
            <Zap className="h-4 w-4 animate-spin text-amber-300" />
            <span>
              Simulating Parallel Threads ({progress.completed}/{progress.total})...
            </span>
          </>
        ) : (
          <>
            <Play className="h-4 w-4 fill-white" />
            <span>Launch Flash Sale Stress Test</span>
          </>
        )}
      </button>
    </div>
  );
}
