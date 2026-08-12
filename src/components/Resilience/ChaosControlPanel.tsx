import React from 'react';
import { Flame } from 'lucide-react';
import { ChaosConfig } from '../../services/PaymentService.js';

export interface ChaosControlPanelProps {
  chaos: ChaosConfig;
  onChaosChange: (key: keyof ChaosConfig, value: any) => void;
}

export function ChaosControlPanel({ chaos, onChaosChange }: ChaosControlPanelProps) {
  return (
    <div className="lg:col-span-6 glass-panel rounded-2xl p-6 space-y-6">
      <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wider flex items-center gap-2">
        <Flame className="h-4 w-4 text-rose-400" />
        Downstream Fault Injector (Chaos)
      </h3>

      <div>
        <div className="flex justify-between items-center text-xs font-medium text-slate-400 mb-2">
          <span>Artificial Error Failure Rate</span>
          <span className="font-mono text-rose-400 font-bold">{chaos.failureRate ?? 0}%</span>
        </div>
        <input
          type="range"
          min="0"
          max="100"
          step="10"
          value={chaos.failureRate ?? 0}
          onChange={(e) => onChaosChange('failureRate', parseInt(e.target.value))}
          className="w-full accent-rose-500 bg-slate-800 rounded-lg cursor-pointer"
        />
      </div>

      <div>
        <div className="flex justify-between items-center text-xs font-medium text-slate-400 mb-2">
          <span>Artificial Network Latency</span>
          <span className="font-mono text-amber-400 font-bold">{chaos.latencyMs ?? 0} ms</span>
        </div>
        <input
          type="range"
          min="0"
          max="3000"
          step="200"
          value={chaos.latencyMs ?? 0}
          onChange={(e) => onChaosChange('latencyMs', parseInt(e.target.value))}
          className="w-full accent-amber-500 bg-slate-800 rounded-lg cursor-pointer"
        />
      </div>

      <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
        <div>
          <div className="text-xs font-semibold text-slate-200">Force Complete Outage</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Simulate 100% gateway downtime (503 Service Unavailable)</div>
        </div>
        <button
          onClick={() => onChaosChange('forceOutage', !chaos.forceOutage)}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
            chaos.forceOutage
              ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/30 animate-pulse'
              : 'bg-slate-800 text-slate-400 hover:text-slate-200'
          }`}
        >
          {chaos.forceOutage ? 'OUTAGE ACTIVE' : 'Normal Operations'}
        </button>
      </div>
    </div>
  );
}
