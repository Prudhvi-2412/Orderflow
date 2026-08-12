import React from 'react';
import { Database } from 'lucide-react';
import { IdempotencyHistoryItem } from '../../core/IdempotencyManager.js';

export interface IdempotencyLogLedgerProps {
  history: IdempotencyHistoryItem[];
}

export function IdempotencyLogLedger({ history }: IdempotencyLogLedgerProps) {
  return (
    <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs h-[320px] flex flex-col">
      <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center justify-between">
        <span>Idempotency State Machine Log</span>
        <span className="text-xs text-slate-500 font-mono">State: PENDING → COMPLETED</span>
      </h4>

      {history.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-slate-400">
          <Database className="h-8 w-8 text-slate-300 mb-2" />
          <p className="text-xs font-semibold text-slate-500">No idempotency entries recorded yet.</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto space-y-2 pr-1 font-mono text-xs">
          {history.map((item) => (
            <div
              key={item.id}
              className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between"
            >
              <div className="flex items-center space-x-2">
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    item.action === 'SERVE_CACHE'
                      ? 'bg-indigo-100 text-indigo-800'
                      : item.action === 'COMPLETE'
                      ? 'bg-emerald-100 text-emerald-800'
                      : item.action === 'IN_FLIGHT_CONFLICT'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {item.action}
                </span>
                <span className="text-slate-800 font-semibold">{item.key}</span>
              </div>

              <div className="text-slate-400 text-[11px]">{new Date(item.timestamp).toLocaleTimeString()}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
