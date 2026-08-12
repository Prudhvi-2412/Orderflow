import React from 'react';
import { TrendingUp, Clock, Radio, Lock } from 'lucide-react';
import { SystemMetricsReport } from '../../core/MetricsEngine.js';

export interface MetricsGridProps {
  metrics: SystemMetricsReport;
  activeLocksCount: number;
  contentionCount: number;
}

export function MetricsGrid({ metrics, activeLocksCount, contentionCount }: MetricsGridProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <div className="glass-panel p-4 rounded-2xl border border-slate-800">
        <div className="flex items-center justify-between text-xs font-mono text-slate-400">
          <span>Throughput</span>
          <TrendingUp className="h-4 w-4 text-cyan-400" />
        </div>
        <div className="text-2xl font-bold font-mono text-cyan-400 text-glow-cyan mt-2">
          {metrics.rps} <span className="text-xs text-slate-400">RPS</span>
        </div>
        <div className="text-[11px] text-slate-500 mt-1 font-mono">Total Requests: {metrics.totalRequests}</div>
      </div>

      <div className="glass-panel p-4 rounded-2xl border border-slate-800">
        <div className="flex items-center justify-between text-xs font-mono text-slate-400">
          <span>P95 Latency</span>
          <Clock className="h-4 w-4 text-purple-400" />
        </div>
        <div className="text-2xl font-bold font-mono text-purple-400 text-glow-purple mt-2">
          {metrics.latencies.p95} <span className="text-xs text-slate-400">ms</span>
        </div>
        <div className="text-[11px] text-slate-500 mt-1 font-mono">
          P50: {metrics.latencies.p50}ms | P99: {metrics.latencies.p99}ms
        </div>
      </div>

      <div className="glass-panel p-4 rounded-2xl border border-slate-800">
        <div className="flex items-center justify-between text-xs font-mono text-slate-400">
          <span>Error Rate</span>
          <Radio className="h-4 w-4 text-rose-400" />
        </div>
        <div
          className={`text-2xl font-bold font-mono mt-2 ${
            metrics.errorRate > 5 ? 'text-rose-400 text-glow-rose' : 'text-emerald-400'
          }`}
        >
          {metrics.errorRate}%
        </div>
        <div className="text-[11px] text-slate-500 mt-1 font-mono">
          Failed: {metrics.failedRequests} / {metrics.totalRequests}
        </div>
      </div>

      <div className="glass-panel p-4 rounded-2xl border border-slate-800">
        <div className="flex items-center justify-between text-xs font-mono text-slate-400">
          <span>Active Mutex Locks</span>
          <Lock className="h-4 w-4 text-amber-400" />
        </div>
        <div className="text-2xl font-bold font-mono text-amber-400 mt-2">
          {activeLocksCount} <span className="text-xs text-slate-400">locks</span>
        </div>
        <div className="text-[11px] text-slate-500 mt-1 font-mono">Contention Count: {contentionCount}</div>
      </div>
    </div>
  );
}
