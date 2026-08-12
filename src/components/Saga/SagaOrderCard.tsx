import React from 'react';
import { StatusBadge } from '../Common/StatusBadge.js';
import { SagaState } from '../../services/OrderService.js';

export interface SagaOrderCardProps {
  order: SagaState;
  isSelected: boolean;
  onSelect: (order: SagaState) => void;
}

export function SagaOrderCard({ order, isSelected, onSelect }: SagaOrderCardProps) {
  return (
    <div
      onClick={() => onSelect(order)}
      className={`p-3 rounded-xl border transition-all cursor-pointer ${
        isSelected
          ? 'bg-slate-800/80 border-cyan-500/50 shadow-md shadow-cyan-500/10'
          : 'bg-slate-900/40 border-slate-800/80 hover:bg-slate-800/40 hover:border-slate-700'
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs font-semibold text-cyan-300">{order.orderId}</span>
        <StatusBadge status={order.status} type="saga" />
      </div>

      <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
        <span>
          Product: <strong className="text-slate-200">{order.sku}</strong>
        </span>
        <span className="font-mono text-emerald-400 font-medium">${order.totalAmount}</span>
      </div>

      <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500 font-mono">
        <span>Strategy: {order.lockStrategy}</span>
        <span>{new Date(order.createdAt).toLocaleTimeString()}</span>
      </div>
    </div>
  );
}
