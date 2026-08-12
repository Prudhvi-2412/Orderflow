import React from 'react';
import { SagaState } from '../../services/OrderService.js';

export interface SagaMetadataViewerProps {
  order: SagaState;
}

export function SagaMetadataViewer({ order }: SagaMetadataViewerProps) {
  return (
    <div className="mt-auto pt-4 border-t border-slate-800">
      <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Transaction Metadata</h4>
      <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs font-mono text-slate-300 space-y-1">
        <div>
          <span className="text-slate-500">Customer:</span> {order.customerEmail}
        </div>
        <div>
          <span className="text-slate-500">Lock Strategy:</span> {order.lockStrategy}
        </div>
        {order.paymentResult?.txnId && (
          <div>
            <span className="text-slate-500">Payment Txn:</span> {order.paymentResult.txnId}
          </div>
        )}
        {order.shippingInfo?.trackingNumber && (
          <div>
            <span className="text-slate-500">Tracking Number:</span> {order.shippingInfo.trackingNumber}
          </div>
        )}
      </div>
    </div>
  );
}
