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
      className={`p-3.5 rounded-xl border transition-all duration-150 cursor-pointer ${
        isSelected
          ? 'bg-blue-50/80 border-blue-500 shadow-sm ring-1 ring-blue-500/30'
          : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/60'
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs font-bold text-blue-700">{order.orderId}</span>
        <StatusBadge status={order.status} type="saga" />
      </div>

      <div className="mt-2.5 flex items-center justify-between text-xs text-slate-600">
        <span>
          Product: <strong className="text-slate-900">{order.sku}</strong>
        </span>
        <span className="font-mono text-emerald-700 font-extrabold text-xs">${order.totalAmount}</span>
      </div>

      <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400 font-mono">
        <span>Lock: <strong className="text-slate-700">{order.lockStrategy}</strong></span>
        <span>{new Date(order.createdAt).toLocaleTimeString()}</span>
      </div>
    </div>
  );
}
