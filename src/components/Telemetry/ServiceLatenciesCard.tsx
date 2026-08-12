import React from 'react';
import { Server } from 'lucide-react';
import { LatencyPercentiles } from '../../core/MetricsEngine.js';

export interface ServiceLatenciesCardProps {
  services: Record<string, { requests: number; errors: number; latencies: LatencyPercentiles }>;
}

export function ServiceLatenciesCard({ services }: ServiceLatenciesCardProps) {
  return (
    <div className="lg:col-span-6 glass-panel rounded-2xl p-5">
      <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wider mb-4 flex items-center gap-2">
        <Server className="h-4 w-4 text-purple-400" />
        Microservice Latencies (P95 Distribution)
      </h3>

      <div className="space-y-3">
        {Object.entries(services).map(([svcName, svcData]) => (
          <div
            key={svcName}
            className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between text-xs font-mono"
          >
            <div>
              <div className="font-semibold text-slate-200">{svcName}</div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Requests: {svcData.requests} | Errors: {svcData.errors}
              </div>
            </div>

            <div className="text-right">
              <div className="text-purple-400 font-bold font-mono">P95: {svcData.latencies.p95}ms</div>
              <div className="text-[11px] text-slate-500">Avg: {svcData.latencies.avg}ms</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
