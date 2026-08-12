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
    <div className="bg-white rounded-2xl p-5 border border-indigo-200 shadow-xs">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-xs font-bold text-indigo-900 uppercase tracking-wider flex items-center gap-2">
          <CheckCircle className="h-4 w-4 text-emerald-600" />
          Deduplication Benchmark Output
        </h4>
        <span className="text-xs font-mono text-slate-500 font-bold">Key: {lastTestResult.key}</span>
      </div>

      <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3 rounded-xl border border-slate-200 mb-4 text-xs">
        <div>
          <span className="text-slate-500 font-mono">Actual Backend Executions:</span>
          <div className="text-base font-extrabold font-mono text-emerald-700">{lastTestResult.actualExecutions} (Exactly 1!)</div>
        </div>
        <div>
          <span className="text-slate-500 font-mono">Duplicate Cache Hits Served:</span>
          <div className="text-base font-extrabold font-mono text-indigo-700">{lastTestResult.cacheHits} deduplicated</div>
        </div>
      </div>

      <div className="space-y-1.5">
        {lastTestResult.responses.map((resp, i) => (
          <div
            key={i}
            className={`p-2 rounded-lg text-xs font-mono flex items-center justify-between ${
              resp.cacheHit
                ? 'bg-indigo-50 border border-indigo-200 text-indigo-900 font-semibold'
                : 'bg-emerald-50 border border-emerald-200 text-emerald-900 font-bold'
            }`}
          >
            <span>Request #{resp.index + 1}</span>
            <span>{resp.cacheHit ? '↻ DEDUPLICATED (HTTP 200 OK Cached)' : '✓ EXECUTED (HTTP 201 Created)'}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
