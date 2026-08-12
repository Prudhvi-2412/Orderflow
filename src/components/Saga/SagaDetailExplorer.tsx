import React from 'react';
import { ChevronRight, AlertTriangle } from 'lucide-react';
import { StatusBadge } from '../Common/StatusBadge.js';
import { SagaStepTimeline } from './SagaStepTimeline.js';
import { SagaMetadataViewer } from './SagaMetadataViewer.js';
import { SagaState } from '../../services/OrderService.js';

export interface SagaDetailExplorerProps {
  selectedOrder: SagaState | null;
}

export function SagaDetailExplorer({ selectedOrder }: SagaDetailExplorerProps) {
  if (!selectedOrder) {
    return (
      <div className="lg:col-span-7 glass-panel rounded-2xl p-5 flex flex-col h-[520px]">
        <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500">
          <ChevronRight className="h-10 w-10 text-slate-700 mb-2 animate-pulse" />
          <p className="text-sm font-medium text-slate-400">Select an order from the ledger</p>
          <p className="text-xs text-slate-500 mt-1">Detailed step-by-step Saga orchestrator traces will appear here.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="lg:col-span-7 glass-panel rounded-2xl p-5 flex flex-col h-[520px]">
      <div className="flex flex-col h-full overflow-y-auto pr-1">
        <div className="pb-4 border-b border-slate-800 flex items-start justify-between">
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-lg font-bold text-slate-100 font-mono">{selectedOrder.orderId}</h3>
              <StatusBadge status={selectedOrder.status} type="saga" />
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Idempotency Key:{' '}
              <code className="font-mono text-cyan-400 bg-slate-900 px-1.5 py-0.5 rounded">
                {selectedOrder.idempotencyKey}
              </code>
            </p>
          </div>

          <div className="text-right">
            <div className="text-sm font-bold text-emerald-400 font-mono">${selectedOrder.totalAmount}</div>
            <div className="text-xs text-slate-400 mt-0.5">Qty: {selectedOrder.quantity}</div>
          </div>
        </div>

        {selectedOrder.status === 'CANCELLED' && (
          <div className="my-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-start gap-2.5">
            <AlertTriangle className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <strong className="font-semibold block text-amber-200 mb-0.5">
                Saga Compensation Triggered (Automated Rollback)
              </strong>
              <span>
                Downstream service failed: {selectedOrder.errorReason}. Inventory stock was automatically released to
                maintain distributed consistency.
              </span>
            </div>
          </div>
        )}

        <SagaStepTimeline steps={selectedOrder.steps} />

        <SagaMetadataViewer order={selectedOrder} />
      </div>
    </div>
  );
}
