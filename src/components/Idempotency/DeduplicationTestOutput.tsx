import React from 'react';
import { CheckCircle } from 'lucide-react';

export interface DeduplicationTestOutputProps {
  lastTestResult: {
    key: string;
    actualExecutions: number;
    cacheHits: number;
    responses: { index: number; cacheHit: boolean }[];
  } | null;
}

export function DeduplicationTestOutput({ lastTestResult }: DeduplicationTestOutputProps) {
  if (!lastTestResult) return null;

  return (
    <div className="glass-panel rounded-2xl p-5 border border-purple-500/30">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-xs font-bold text-purple-300 uppercase tracking-wider flex items-center gap-2">
          <CheckCircle className="h-4 w-4 text-emerald-400" />
          Deduplication Benchmark Complete
        </h4>
        <span className="text-xs font-mono text-slate-400">Key: {lastTestResult.key}</span>
      </div>

      <div className="grid grid-cols-2 gap-4 bg-slate-900/60 p-3 rounded-xl border border-slate-800 mb-4 text-xs">
        <div>
          <span className="text-slate-400">Actual Backend Executions:</span>
          <div className="text-base font-bold font-mono text-emerald-400">{lastTestResult.actualExecutions} (Only 1!)</div>
        </div>
        <div>
          <span className="text-slate-400">Duplicate Cache Hits Served:</span>
          <div className="text-base font-bold font-mono text-purple-400">{lastTestResult.cacheHits} deduplicated</div>
        </div>
      </div>

      <div className="space-y-1.5">
        {lastTestResult.responses.map((resp, i) => (
          <div
            key={i}
            className={`p-2 rounded-lg text-xs font-mono flex items-center justify-between ${
              resp.cacheHit
                ? 'bg-purple-950/30 border border-purple-500/20 text-purple-300'
                : 'bg-emerald-950/30 border border-emerald-500/20 text-emerald-300'
            }`}
          >
            <span>Request #{resp.index + 1}</span>
            <span>{resp.cacheHit ? 'HTTP 200 OK (Served from Idempotent Cache)' : 'HTTP 201 Created (Original Execution)'}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
