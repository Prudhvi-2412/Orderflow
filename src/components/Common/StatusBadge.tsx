import React from 'react';
import { CheckCircle2, XCircle, RotateCcw, Clock } from 'lucide-react';

export interface StatusBadgeProps {
  status: string;
  type?: 'saga' | 'step';
}

export function StatusBadge({ status, type = 'saga' }: StatusBadgeProps) {
  if (type === 'saga') {
    switch (status) {
      case 'COMPLETED':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="h-3 w-3" />
            <span>Saga Completed</span>
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <RotateCcw className="h-3 w-3 animate-spin" />
            <span>Compensated (Rolled Back)</span>
          </span>
        );
      case 'FAILED':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <XCircle className="h-3 w-3" />
            <span>Saga Failed</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-medium bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 animate-pulse">
            <Clock className="h-3 w-3" />
            <span>In Flight</span>
          </span>
        );
    }
  }

  return null;
}
