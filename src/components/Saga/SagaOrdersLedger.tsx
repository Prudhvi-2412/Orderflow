import React from 'react';
import { Info } from 'lucide-react';
import { SagaOrderCard } from './SagaOrderCard.js';
import { SagaState } from '../../services/OrderService.js';

export interface SagaOrdersLedgerProps {
  orders: SagaState[];
  selectedOrder: SagaState | null;
  onSelectOrder: (order: SagaState) => void;
}

export function SagaOrdersLedger({ orders, selectedOrder, onSelectOrder }: SagaOrdersLedgerProps) {
  return (
    <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-5 flex flex-col h-[520px] shadow-xs">
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
        <h3 className="text-sm font-bold text-slate-900">Saga Orders Ledger ({orders.length})</h3>
        <span className="text-xs text-slate-500 font-mono font-medium">Live Sync</span>
      </div>

      {orders.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-6 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
          <Info className="h-8 w-8 text-slate-400 mb-2" />
          <p className="text-sm font-semibold text-slate-700">No orders in ledger yet.</p>
          <p className="text-xs text-slate-500 mt-1">Click "+ Create Custom Order" or "Simulate Flash Sale" above.</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
          {orders.map((ord) => (
            <SagaOrderCard
              key={ord.orderId}
              order={ord}
              isSelected={selectedOrder?.orderId === ord.orderId}
              onSelect={onSelectOrder}
            />
          ))}
        </div>
      )}
    </div>
  );
}
