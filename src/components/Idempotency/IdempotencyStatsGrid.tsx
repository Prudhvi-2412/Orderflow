import React from 'react';

export interface IdempotencyStatsGridProps {
  stats: {
    totalRequests: number;
    cachedHits: number;
    inFlightConflicts: number;
    payloadMismatches: number;
  };
}

export function IdempotencyStatsGrid({ stats }: IdempotencyStatsGridProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <div className="glass-panel p-3.5 rounded-xl border border-slate-800">
        <span className="text-slate-400 text-[11px] font-mono">Total Submissions</span>
        <div className="text-xl font-bold font-mono text-slate-100 mt-1">{stats.totalRequests}</div>
      </div>

      <div className="glass-panel p-3.5 rounded-xl border border-slate-800">
        <span className="text-slate-400 text-[11px] font-mono">Cached Hits Served</span>
        <div className="text-xl font-bold font-mono text-purple-400 text-glow-purple mt-1">{stats.cachedHits}</div>
      </div>

      <div className="glass-panel p-3.5 rounded-xl border border-slate-800">
        <span className="text-slate-400 text-[11px] font-mono">In-Flight Conflicts (409)</span>
        <div className="text-xl font-bold font-mono text-amber-400 mt-1">{stats.inFlightConflicts}</div>
      </div>

      <div className="glass-panel p-3.5 rounded-xl border border-slate-800">
        <span className="text-slate-400 text-[11px] font-mono">Payload Mismatches (422)</span>
        <div className="text-xl font-bold font-mono text-rose-400 mt-1">{stats.payloadMismatches}</div>
      </div>
    </div>
  );
}
