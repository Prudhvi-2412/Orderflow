import React from 'react';
import { Flame } from 'lucide-react';
import { ChaosConfig } from '../../services/PaymentService.js';

export interface ChaosControlPanelProps {
  chaos: ChaosConfig;
  onChaosChange: (key: keyof ChaosConfig, value: any) => void;
}

export function ChaosControlPanel({ chaos, onChaosChange }: ChaosControlPanelProps) {
  return (
    <div className="lg:col-span-6 bg-white rounded-2xl border border-slate-200 p-6 space-y-6 shadow-xs">
      <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
        <Flame className="h-4 w-4 text-rose-600" />
        Downstream Fault Injector (Chaos Engine)
      </h3>

      <div>
        <div className="flex justify-between items-center text-xs font-semibold text-slate-700 mb-2">
          <span>Artificial Error Failure Rate</span>
          <span className="font-mono text-rose-700 font-bold">{chaos.failureRate ?? 0}%</span>
        </div>
        <input
          type="range"
          min="0"
          max="100"
          step="10"
          value={chaos.failureRate ?? 0}
          onChange={(e) => onChaosChange('failureRate', parseInt(e.target.value))}
          className="w-full accent-rose-600 bg-slate-200 rounded-lg cursor-pointer"
        />
      </div>

      <div>
        <div className="flex justify-between items-center text-xs font-semibold text-slate-700 mb-2">
          <span>Artificial Network Latency</span>
          <span className="font-mono text-amber-700 font-bold">{chaos.latencyMs ?? 0} ms</span>
        </div>
        <input
          type="range"
          min="0"
          max="3000"
          step="200"
          value={chaos.latencyMs ?? 0}
          onChange={(e) => onChaosChange('latencyMs', parseInt(e.target.value))}
          className="w-full accent-amber-600 bg-slate-200 rounded-lg cursor-pointer"
        />
      </div>

      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
        <div>
          <div className="text-xs font-bold text-slate-900">Force Complete Outage</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Simulate 100% gateway downtime (503 Service Unavailable)</div>
        </div>
        <button
          onClick={() => onChaosChange('forceOutage', !chaos.forceOutage)}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
            chaos.forceOutage
              ? 'bg-rose-600 text-white shadow-sm animate-pulse'
              : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
          }`}
        >
          {chaos.forceOutage ? 'OUTAGE ACTIVE' : 'Normal Operations'}
        </button>
      </div>
    </div>
  );
}
