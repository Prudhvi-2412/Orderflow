import React from 'react';
import { Zap } from 'lucide-react';
import { OutboxEvent } from '../../core/EventBus.js';

export interface OutboxEventStreamProps {
  filteredLogs: OutboxEvent[];
  topics: string[];
  selectedTopicFilter: string;
  onSelectTopicFilter: (topic: string) => void;
}

export function OutboxEventStream({
  filteredLogs,
  topics,
  selectedTopicFilter,
  onSelectTopicFilter
}: OutboxEventStreamProps) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
          <Zap className="h-4 w-4 text-blue-600" />
          Live Outbox Event Bus Stream ({filteredLogs.length})
        </h3>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 font-mono">Filter Topic:</span>
          <select
            value={selectedTopicFilter}
            onChange={(e) => onSelectTopicFilter(e.target.value)}
            className="input-enterprise px-3 py-1.5 text-xs font-mono bg-white text-blue-700 font-bold"
          >
            {topics.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1 font-mono text-xs">
        {filteredLogs.map((log) => (
          <div
            key={log.id}
            className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2"
          >
            <div className="flex items-center space-x-3">
              <span
                className={`px-2.5 py-1 rounded text-[10px] font-bold ${
                  log.topic === 'OrderCreated'
                    ? 'bg-blue-100 text-blue-800'
                    : log.topic === 'InventoryReserved'
                    ? 'bg-indigo-100 text-indigo-800'
                    : log.topic === 'PaymentProcessed'
                    ? 'bg-emerald-100 text-emerald-800'
                    : log.topic === 'OrderFailed'
                    ? 'bg-rose-100 text-rose-800'
                    : 'bg-slate-200 text-slate-700'
                }`}
              >
                {log.topic}
              </span>
              <span className="text-slate-800 font-semibold">ID: {log.id}</span>
            </div>

            <div className="flex items-center space-x-4 text-[11px] text-slate-500">
              <span>
                Saga: <strong className="text-slate-900">{log.sagaId || 'N/A'}</strong>
              </span>
              <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
