import React from 'react';

export interface StockStatusCardProps {
  item: { name: string; stock: number } | null;
}

export function StockStatusCard({ item }: StockStatusCardProps) {
  return (
    <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 mb-6 flex items-center justify-between">
      <div>
        <span className="text-xs text-slate-400 font-mono">Selected Item:</span>
        <h4 className="text-base font-bold text-slate-100">{item?.name}</h4>
      </div>
      <div className="text-right">
        <div className="text-xs text-slate-400 font-mono">Remaining Stock</div>
        <div
          className={`text-2xl font-bold font-mono ${
            item && item.stock < 0 ? 'text-rose-400 text-glow-rose' : 'text-cyan-400'
          }`}
        >
          {item?.stock} units
        </div>
      </div>
    </div>
  );
}
