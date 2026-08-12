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
          <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-glow-emerald">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            <span>CLOSED (Normal Traffic Flow)</span>
          </span>
        );
      case 'OPEN':
        return (
          <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-500/10 text-rose-400 border border-rose-500/30 text-glow-rose animate-pulse">
            <XCircle className="h-4 w-4 text-rose-400" />
            <span>OPEN (Fast-Failing Requests)</span>
          </span>
        );
      case 'HALF_OPEN':
        return (
          <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
            <Clock className="h-4 w-4 text-amber-400 animate-spin" />
            <span>HALF_OPEN (Testing Recovery Probe)</span>
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="lg:col-span-6 glass-panel rounded-2xl p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wider flex items-center gap-2">
          <Cpu className="h-4 w-4 text-emerald-400" />
          Payment Gateway Circuit Breaker
        </h3>
        {getCBBadge(cbState.state)}
      </div>

      <div className="grid grid-cols-3 gap-3 bg-slate-900/60 p-4 rounded-xl border border-slate-800">
        <div>
          <span className="text-slate-400 text-[11px] font-mono">Failures</span>
          <div className="text-lg font-bold font-mono text-rose-400 mt-0.5">{cbState.failureCount} / 3</div>
        </div>

        <div>
          <span className="text-slate-400 text-[11px] font-mono">Success Probe</span>
          <div className="text-lg font-bold font-mono text-emerald-400 mt-0.5">{cbState.successCount} / 2</div>
        </div>

        <div>
          <span className="text-slate-400 text-[11px] font-mono">Reset Timer</span>
          <div className="text-lg font-bold font-mono text-amber-400 mt-0.5">
            {cbState.state === 'OPEN' ? `${cbState.nextAttemptIn}s` : 'N/A'}
          </div>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-400 mb-2">Manual State Override</label>
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => onForceState('CLOSED')}
            className="px-3 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-semibold transition"
          >
            Force CLOSED
          </button>

          <button
            onClick={() => onForceState('OPEN')}
            className="px-3 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-semibold transition"
          >
            Force OPEN
          </button>

          <button
            onClick={() => onForceState('HALF_OPEN')}
            className="px-3 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-semibold transition"
          >
            Force HALF_OPEN
          </button>
        </div>
      </div>

      <div>
        <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">State Transition Log</h4>
        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 font-mono text-[11px] h-32 overflow-y-auto space-y-1.5 text-slate-400">
          {cbHistory.map((h) => (
            <div key={h.id} className="flex items-start space-x-2">
              <span className="text-cyan-400 font-bold">[{h.event}]</span>
              <span className="text-slate-300">{h.detail}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
