import React from 'react';
import { CheckCircle2, XCircle, Clock } from 'lucide-react';
import { SagaStep } from '../../services/OrderService.js';

export interface SagaStepTimelineProps {
  steps: SagaStep[];
}

export function SagaStepTimeline({ steps }: SagaStepTimelineProps) {
  const getStepStatusIcon = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <CheckCircle2 className="h-4 w-4 text-emerald-400" />;
      case 'FAILED':
        return <XCircle className="h-4 w-4 text-rose-400" />;
      case 'IN_PROGRESS':
        return <Clock className="h-4 w-4 text-cyan-400 animate-spin" />;
      default:
        return <Clock className="h-4 w-4 text-slate-600" />;
    }
  };

  return (
    <div className="py-4 space-y-4">
      <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Saga Orchestration Timeline</h4>

      <div className="space-y-3">
        {steps.map((step, idx) => (
          <div
            key={idx}
            className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 flex items-center justify-between"
          >
            <div className="flex items-center space-x-3">
              <div className="p-1.5 rounded-lg bg-slate-800 text-slate-300">{getStepStatusIcon(step.status)}</div>
              <div>
                <div className="text-xs font-semibold text-slate-200">{step.name}</div>
                <div className="text-[11px] text-slate-500 font-mono">
                  {step.timestamp ? `Executed at ${new Date(step.timestamp).toLocaleTimeString()}` : 'Awaiting phase...'}
                </div>
              </div>
            </div>

            <div className="text-right">
              <span
                className={`text-xs font-mono px-2 py-0.5 rounded ${
                  step.status === 'COMPLETED'
                    ? 'bg-emerald-500/10 text-emerald-400'
                    : step.status === 'FAILED'
                    ? 'bg-rose-500/10 text-rose-400'
                    : step.status === 'IN_PROGRESS'
                    ? 'bg-cyan-500/10 text-cyan-400'
                    : 'bg-slate-800 text-slate-500'
                }`}
              >
                {step.status}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
