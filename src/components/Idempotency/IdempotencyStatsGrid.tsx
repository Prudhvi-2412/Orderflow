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
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
        <span className="text-slate-500 text-[11px] font-mono">Total Submissions</span>
        <div className="text-xl font-bold font-mono text-slate-900 mt-1">{stats.totalRequests}</div>
      </div>

      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
        <span className="text-slate-500 text-[11px] font-mono">Cached Hits Served</span>
        <div className="text-xl font-bold font-mono text-indigo-700 font-extrabold mt-1">{stats.cachedHits}</div>
      </div>

      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
        <span className="text-slate-500 text-[11px] font-mono">In-Flight Conflicts (409)</span>
        <div className="text-xl font-bold font-mono text-amber-700 mt-1">{stats.inFlightConflicts}</div>
      </div>

      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
        <span className="text-slate-500 text-[11px] font-mono">Payload Mismatches (422)</span>
        <div className="text-xl font-bold font-mono text-rose-700 mt-1">{stats.payloadMismatches}</div>
      </div>
    </div>
  );
}
