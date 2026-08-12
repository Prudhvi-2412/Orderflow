import React from 'react';
import { Cpu, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { CircuitBreakerState } from '../../core/CircuitBreaker.js';

export interface CircuitBreakerHudProps {
  cbState: {
    state: CircuitBreakerState;
    failureCount: number;
    successCount: number;
    nextAttemptIn: number;
  };
  cbHistory: { id: string; event: string; detail: string }[];
  onForceState: (state: CircuitBreakerState) => void;
}

export function CircuitBreakerHud({ cbState, cbHistory, onForceState }: CircuitBreakerHudProps) {
  const getCBBadge = (state: CircuitBreakerState) => {
    switch (state) {
      case 'CLOSED':
        return (
          <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <span>CLOSED (Normal Traffic Flow)</span>
          </span>
        );
      case 'OPEN':
        return (
          <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200 animate-pulse">
            <XCircle className="h-4 w-4 text-rose-600" />
            <span>OPEN (Fast-Failing Requests)</span>
          </span>
        );
      case 'HALF_OPEN':
        return (
          <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
            <Clock className="h-4 w-4 text-amber-600 animate-spin" />
            <span>HALF_OPEN (Testing Recovery Probe)</span>
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="lg:col-span-6 bg-white rounded-2xl border border-slate-200 p-6 space-y-6 shadow-xs">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
          <Cpu className="h-4 w-4 text-blue-600" />
          Payment Gateway Circuit Breaker
        </h3>
        {getCBBadge(cbState.state)}
      </div>

      <div className="grid grid-cols-3 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
        <div>
          <span className="text-slate-500 text-[11px] font-mono">Failures</span>
          <div className="text-lg font-bold font-mono text-rose-700 mt-0.5">{cbState.failureCount} / 3</div>
        </div>

        <div>
          <span className="text-slate-500 text-[11px] font-mono">Success Probe</span>
          <div className="text-lg font-bold font-mono text-emerald-700 mt-0.5">{cbState.successCount} / 2</div>
        </div>

        <div>
          <span className="text-slate-500 text-[11px] font-mono">Reset Timer</span>
          <div className="text-lg font-bold font-mono text-amber-700 mt-0.5">
            {cbState.state === 'OPEN' ? `${cbState.nextAttemptIn}s` : 'N/A'}
          </div>
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-700 mb-2">Manual State Override</label>
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => onForceState('CLOSED')}
            className="px-3 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold transition"
          >
            Force CLOSED
          </button>

          <button
            onClick={() => onForceState('OPEN')}
            className="px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 text-xs font-bold transition"
          >
            Force OPEN
          </button>

          <button
            onClick={() => onForceState('HALF_OPEN')}
            className="px-3 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-bold transition"
          >
            Force HALF_OPEN
          </button>
        </div>
      </div>

      <div>
        <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">State Transition Log</h4>
        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 font-mono text-[11px] h-32 overflow-y-auto space-y-1.5 text-slate-600">
          {cbHistory.map((h) => (
            <div key={h.id} className="flex items-start space-x-2">
              <span className="text-blue-700 font-bold">[{h.event}]</span>
              <span className="text-slate-800">{h.detail}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
