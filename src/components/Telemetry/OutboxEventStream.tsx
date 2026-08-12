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
    <div className="glass-panel rounded-2xl p-5">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
        <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wider flex items-center gap-2">
          <Zap className="h-4 w-4 text-cyan-400" />
          Live Outbox Event Bus Stream ({filteredLogs.length})
        </h3>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 font-mono">Filter Topic:</span>
          <select
            value={selectedTopicFilter}
            onChange={(e) => onSelectTopicFilter(e.target.value)}
            className="glass-input rounded-xl px-3 py-1.5 text-xs font-mono bg-slate-900 text-cyan-300"
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
            className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2"
          >
            <div className="flex items-center space-x-3">
              <span
                className={`px-2.5 py-1 rounded text-[10px] font-bold ${
                  log.topic === 'OrderCreated'
                    ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                    : log.topic === 'InventoryReserved'
                    ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                    : log.topic === 'PaymentProcessed'
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : log.topic === 'OrderFailed'
                    ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                    : 'bg-slate-800 text-slate-300'
                }`}
              >
                {log.topic}
              </span>
              <span className="text-slate-300">ID: {log.id}</span>
            </div>

            <div className="flex items-center space-x-4 text-[11px] text-slate-500">
              <span>
                Saga: <strong className="text-slate-400">{log.sagaId || 'N/A'}</strong>
              </span>
              <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
