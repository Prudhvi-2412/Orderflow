import React from 'react';
import { ShieldCheck, RotateCcw, Zap } from 'lucide-react';

export interface IdempotencyPlaygroundProps {
  idempotencyKey: string;
  setIdempotencyKey: (key: string) => void;
  sku: string;
  setSku: (sku: string) => void;
  quantity: number;
  setQuantity: (qty: number) => void;
  price: number;
  setPrice: (price: number) => void;
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
    <div className="lg:col-span-5 glass-panel rounded-2xl p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wider flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-purple-400" />
          Idempotency Playground
        </h3>
        <button
          onClick={onClearStore}
          className="text-xs text-slate-400 hover:text-purple-400 flex items-center gap-1 transition"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Clear Store
        </button>
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-400 mb-2">Idempotency-Key Header</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={idempotencyKey}
            onChange={(e) => setIdempotencyKey(e.target.value)}
            className="flex-1 glass-input rounded-xl px-3 py-2 text-xs font-mono font-semibold text-purple-300"
          />
          <button
            onClick={onGenerateKey}
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono transition"
          >
            New Key
          </button>
        </div>
      </div>

      <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 space-y-3">
        <h4 className="text-xs font-semibold text-slate-300">Request Body Payload</h4>

        <div>
          <label className="block text-[11px] text-slate-400 font-mono">SKU</label>
          <input
            type="text"
            value={sku}
            onChange={(e) => setSku(e.target.value)}
            className="w-full glass-input rounded-lg px-2.5 py-1.5 text-xs font-mono mt-1"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] text-slate-400 font-mono">Quantity</label>
            <input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
              className="w-full glass-input rounded-lg px-2.5 py-1.5 text-xs font-mono mt-1"
            />
          </div>

          <div>
            <label className="block text-[11px] text-slate-400 font-mono">Price ($)</label>
            <input
              type="number"
              value={price}
              onChange={(e) => setPrice(parseInt(e.target.value) || 0)}
              className="w-full glass-input rounded-lg px-2.5 py-1.5 text-xs font-mono mt-1"
            />
          </div>
        </div>
      </div>

      <button
        onClick={onRun5x}
        disabled={isExecuting}
        className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold text-xs hover:from-purple-500 hover:to-indigo-500 transition shadow-lg shadow-purple-500/20 flex items-center justify-center space-x-2"
      >
        <Zap className="h-4 w-4 fill-white" />
        <span>Rapid Fire Duplicate Submit (5x Parallel)</span>
      </button>
    </div>
  );
}
