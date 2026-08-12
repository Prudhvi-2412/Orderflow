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
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
            <span>CONFIRMED</span>
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
            <RotateCcw className="h-3.5 w-3.5 text-amber-600" />
            <span>COMPENSATED</span>
          </span>
        );
      case 'FAILED':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
            <XCircle className="h-3.5 w-3.5 text-rose-600" />
            <span>FAILED</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200 animate-pulse">
            <Clock className="h-3.5 w-3.5 text-blue-600" />
            <span>PROCESSING</span>
          </span>
        );
    }
  }

  return null;
}
