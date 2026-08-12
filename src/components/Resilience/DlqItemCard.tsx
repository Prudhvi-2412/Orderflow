import React from 'react';
import { RefreshCw } from 'lucide-react';
import { DLQItem } from '../../core/EventBus.js';

export interface DlqItemCardProps {
  item: DLQItem;
  onRedrive: (id: string) => void;
}

export function DlqItemCard({ item, onRedrive }: DlqItemCardProps) {
  return (
    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
      <div className="space-y-1">
        <div className="flex items-center space-x-2">
          <span className="font-mono text-xs font-bold text-rose-800 bg-rose-100 px-2 py-0.5 rounded border border-rose-200">
            {item.topic}
          </span>
          <span className="font-mono text-xs text-slate-800 font-bold">ID: {item.id}</span>
        </div>
        <p className="text-xs text-slate-600">
          Reason: <strong className="text-slate-900">{item.reason}</strong>
        </p>
        <p className="text-[11px] font-mono text-slate-500">
          Failed at {new Date(item.deadLetteredAt).toLocaleString()} ({item.attempts} attempts)
        </p>
      </div>

      <button
        onClick={() => onRedrive(item.id)}
        className="px-3.5 py-2 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-bold transition flex items-center gap-1.5 flex-shrink-0"
      >
        <RefreshCw className="h-3.5 w-3.5" />
        Re-drive Message
      </button>
    </div>
  );
}
