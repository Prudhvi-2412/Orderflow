import React from 'react';
import { Repeat, RefreshCw, Zap, Trash2 } from 'lucide-react';

export interface IdempotencyPlaygroundProps {
  idempotencyKey: string;
  setIdempotencyKey: (key: string) => void;
  sku: string;
  setSku: (sku: string) => void;
  quantity: number;
  setQuantity: (q: number) => void;
  price: number;
  setPrice: (p: number) => void;
  isExecuting: boolean;
  onGenerateKey: () => void;
  onRun5x: () => void;
  onClearStore: () => void;
}

export function IdempotencyPlayground({
  idempotencyKey,
  setIdempotencyKey,
  sku,
  setSku,
  quantity,
  setQuantity,
  price,
  setPrice,
  isExecuting,
  onGenerateKey,
  onRun5x,
  onClearStore
}: IdempotencyPlaygroundProps) {
  return (
    <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-6 space-y-6 shadow-xs">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
          <Repeat className="h-4 w-4 text-blue-600" />
          Idempotency Key Playground
        </h3>
        <button
          onClick={onClearStore}
          className="text-xs text-slate-500 hover:text-rose-600 flex items-center gap-1 transition font-medium"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Clear Store
        </button>
      </div>

      <div>
        <div className="flex justify-between items-center text-xs font-semibold text-slate-700 mb-1.5">
          <span>Idempotency-Key Header</span>
          <button
            onClick={onGenerateKey}
            className="text-[11px] font-mono text-blue-700 hover:underline flex items-center gap-1"
          >
            <RefreshCw className="h-3 w-3" />
            Generate New Key
          </button>
        </div>
        <input
          type="text"
          value={idempotencyKey}
          onChange={(e) => setIdempotencyKey(e.target.value)}
          className="w-full input-enterprise px-3 py-2 text-xs font-mono text-blue-700 font-bold"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Target SKU</label>
          <select
            value={sku}
            onChange={(e) => setSku(e.target.value)}
            className="w-full input-enterprise px-3 py-2 text-xs font-medium"
          >
            <option value="ITEM-IPHONE-15">ITEM-IPHONE-15</option>
            <option value="ITEM-GPU-4090">ITEM-GPU-4090</option>
            <option value="ITEM-PS5-PRO">ITEM-PS5-PRO</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Unit Price ($)</label>
          <input
            type="number"
            value={price}
            onChange={(e) => setPrice(Number(e.target.value))}
            className="w-full input-enterprise px-3 py-2 text-xs font-mono"
          />
        </div>
      </div>

      <button
        onClick={onRun5x}
        disabled={isExecuting}
        className={`w-full py-3 rounded-xl font-bold text-xs transition flex items-center justify-center space-x-2 shadow-sm ${
          isExecuting
            ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
            : 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-500/20'
        }`}
      >
        {isExecuting ? (
          <>
            <Zap className="h-4 w-4 animate-spin text-amber-300" />
            <span>Firing 5x Rapid Parallel Requests...</span>
          </>
        ) : (
          <>
            <Zap className="h-4 w-4 fill-white" />
            <span>Fire 5x Rapid Fire Duplicate Requests</span>
          </>
        )}
      </button>

      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs text-slate-600 space-y-2">
        <h4 className="font-bold text-slate-900">How Exactly-Once Deduplication Works:</h4>
        <p className="leading-relaxed">
          1. Request #1 acquires atomic lock on key <code className="font-mono text-blue-700 font-bold">{idempotencyKey}</code>, executes Saga, caches result hash.
        </p>
        <p className="leading-relaxed">
          2. Concurrent Requests #2-#5 match active lease or cached result, returning cached HTTP status response instantly without re-executing payment or inventory deductions.
        </p>
      </div>
    </div>
  );
}
