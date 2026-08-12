import React from 'react';
import { Server } from 'lucide-react';
import { LatencyPercentiles } from '../../core/MetricsEngine.js';

export interface ServiceLatenciesCardProps {
  services: Record<string, { requests: number; errors: number; latencies: LatencyPercentiles }>;
}

export function ServiceLatenciesCard({ services }: ServiceLatenciesCardProps) {
  return (
    <div className="lg:col-span-6 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
      <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
        <Server className="h-4 w-4 text-indigo-600" />
        Microservice Latencies (P95 Distribution)
      </h3>

      <div className="space-y-3">
        {Object.entries(services).map(([svcName, svcData]) => (
          <div
            key={svcName}
            className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs font-mono"
          >
            <div>
              <div className="font-bold text-slate-900">{svcName}</div>
              <div className="text-[11px] text-slate-500 mt-0.5 font-sans">
                Requests: {svcData.requests} | Errors: {svcData.errors}
              </div>
            </div>

            <div className="text-right">
              <div className="text-indigo-700 font-extrabold font-mono">P95: {svcData.latencies.p95}ms</div>
              <div className="text-[11px] text-slate-500 font-sans">Avg: {svcData.latencies.avg}ms</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
