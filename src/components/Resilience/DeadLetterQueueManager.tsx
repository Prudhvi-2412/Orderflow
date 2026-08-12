import React from 'react';
import { AlertTriangle, Trash2, CheckCircle2 } from 'lucide-react';
import { DlqItemCard } from './DlqItemCard.js';
import { DLQItem } from '../../core/EventBus.js';

export interface DeadLetterQueueManagerProps {
  dlqItems: DLQItem[];
  maxRetries: number;
  onRedrive: (id: string) => void;
  onPurge: () => void;
}

export function DeadLetterQueueManager({ dlqItems, maxRetries, onRedrive, onPurge }: DeadLetterQueueManagerProps) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            Dead Letter Queue (DLQ) Manager ({dlqItems.length})
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Messages that failed handler execution after maximum retries ({maxRetries} attempts).
          </p>
        </div>

        {dlqItems.length > 0 && (
          <button
            onClick={onPurge}
            className="px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition flex items-center gap-1.5"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Purge DLQ
          </button>
        )}
      </div>

      {dlqItems.length === 0 ? (
        <div className="p-8 text-center border border-dashed border-slate-200 rounded-xl text-slate-400 bg-slate-50/50">
          <CheckCircle2 className="h-8 w-8 text-emerald-600 mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-700">Dead Letter Queue is empty</p>
          <p className="text-xs text-slate-500 mt-1">
            Inject failure chaos or force payment gateway outage to generate unrecoverable events.
          </p>
        </div>
      ) : (
        <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
          {dlqItems.map((item) => (
            <DlqItemCard key={item.id} item={item} onRedrive={onRedrive} />
          ))}
        </div>
      )}
    </div>
  );
}
