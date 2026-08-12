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
    <div className="lg:col-span-5 glass-panel rounded-2xl p-6 space-y-6">
      <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wider flex items-center justify-between">
        <span className="flex items-center gap-2">
          <Sliders className="h-4 w-4 text-cyan-400" />
          Flash Sale Settings
        </span>
        <button
          onClick={onReset}
          className="text-xs text-slate-400 hover:text-cyan-400 flex items-center gap-1 transition"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Reset Stock
        </button>
      </h3>

      <div>
        <label className="block text-xs font-medium text-slate-400 mb-2">Target Flash Sale Item</label>
        <select
          value={sku}
          onChange={(e) => setSku(e.target.value)}
          className="w-full glass-input rounded-xl px-3 py-2 text-sm font-medium"
        >
          {items.map((item) => (
            <option key={item.id} value={item.id} className="bg-slate-900 text-slate-100">
              {item.name} (Current Stock: {item.stock})
            </option>
          ))}
        </select>
      </div>

      <div>
        <div className="flex justify-between items-center text-xs font-medium text-slate-400 mb-2">
          <span>Initial Inventory Stock</span>
          <span className="font-mono text-cyan-400 font-bold">{stockQty} units</span>
        </div>
        <input
          type="range"
          min="1"
          max="20"
          value={stockQty}
          onChange={(e) => setStockQty(Number(e.target.value))}
          className="w-full accent-cyan-500 bg-slate-800 rounded-lg cursor-pointer"
        />
      </div>

      <div>
        <div className="flex justify-between items-center text-xs font-medium text-slate-400 mb-2">
          <span>Concurrent User Threads</span>
          <span className="font-mono text-purple-400 font-bold">{concurrentUsers} requests</span>
        </div>
        <input
          type="range"
          min="5"
          max="60"
          step="5"
          value={concurrentUsers}
          onChange={(e) => setConcurrentUsers(Number(e.target.value))}
          className="w-full accent-purple-500 bg-slate-800 rounded-lg cursor-pointer"
        />
      </div>

      <LockStrategySelector selectedStrategy={lockStrategy} onChangeStrategy={setLockStrategy} />

      <button
        onClick={onRun}
        disabled={isSimulating}
        className={`w-full py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center space-x-2 shadow-lg ${
          isSimulating
            ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
            : 'bg-gradient-to-r from-amber-500 via-rose-500 to-purple-600 text-white hover:from-amber-400 hover:to-purple-500 shadow-rose-500/25'
        }`}
      >
        {isSimulating ? (
          <>
            <Zap className="h-4 w-4 animate-spin text-amber-400" />
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
