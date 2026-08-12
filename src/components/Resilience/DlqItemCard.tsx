import React from 'react';
import { RefreshCw } from 'lucide-react';
import { DLQItem } from '../../core/EventBus.js';

export interface DlqItemCardProps {
  item: DLQItem;
  onRedrive: (id: string) => void;
}

export function DlqItemCard({ item, onRedrive }: DlqItemCardProps) {
  return (
    <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
      <div className="space-y-1">
        <div className="flex items-center space-x-2">
          <span className="font-mono text-xs font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
            {item.topic}
          </span>
          <span className="font-mono text-xs text-slate-300">ID: {item.id}</span>
        </div>
        <p className="text-xs text-slate-400">
          Reason: <strong className="text-slate-200">{item.reason}</strong>
        </p>
        <p className="text-[11px] font-mono text-slate-500">
          Failed at {new Date(item.deadLetteredAt).toLocaleString()} ({item.attempts} attempts)
        </p>
      </div>

      <button
        onClick={() => onRedrive(item.id)}
        className="px-3.5 py-2 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-xs font-semibold transition flex items-center gap-1.5 flex-shrink-0"
      >
        <RefreshCw className="h-3.5 w-3.5" />
        Re-drive DLQ Message
      </button>
    </div>
  );
}
