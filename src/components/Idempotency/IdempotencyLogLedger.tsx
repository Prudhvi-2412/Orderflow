import React from 'react';
import { Database } from 'lucide-react';
import { IdempotencyHistoryItem } from '../../core/IdempotencyManager.js';

export interface IdempotencyLogLedgerProps {
  history: IdempotencyHistoryItem[];
}

export function IdempotencyLogLedger({ history }: IdempotencyLogLedgerProps) {
  return (
    <div className="glass-panel rounded-2xl p-5 h-[320px] flex flex-col">
      <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-4 flex items-center justify-between">
        <span>Idempotency State Machine Log</span>
        <span className="text-xs text-slate-500 font-mono">State: PENDING → COMPLETED</span>
      </h4>

      {history.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-slate-500">
          <Database className="h-8 w-8 text-slate-700 mb-2" />
          <p className="text-xs">No idempotency entries recorded yet.</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto space-y-2 pr-1 font-mono text-xs">
          {history.map((item) => (
            <div
              key={item.id}
              className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/80 flex items-center justify-between"
            >
              <div className="flex items-center space-x-2">
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    item.action === 'SERVE_CACHE'
                      ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                      : item.action === 'COMPLETE'
                      ? 'bg-emerald-500/10 text-emerald-400'
                      : item.action === 'IN_FLIGHT_CONFLICT'
                      ? 'bg-amber-500/10 text-amber-400'
                      : 'bg-slate-800 text-slate-300'
                  }`}
                >
                  {item.action}
                </span>
                <span className="text-slate-300">{item.key}</span>
              </div>

              <div className="text-slate-500 text-[11px]">{new Date(item.timestamp).toLocaleTimeString()}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
