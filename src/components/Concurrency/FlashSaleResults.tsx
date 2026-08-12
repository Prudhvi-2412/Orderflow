import React from 'react';
import { AlertOctagon, CheckCircle, Box } from 'lucide-react';
import { StockStatusCard } from './StockStatusCard.js';

export interface FlashSaleResultsProps {
  currentItem: any;
  lastResults: any;
  isSimulating: boolean;
  progress: { completed: number; total: number };
  contentionCount: number;
}

export function FlashSaleResults({
  currentItem,
  lastResults,
  isSimulating,
  progress,
  contentionCount
}: FlashSaleResultsProps) {
  return (
    <div className="lg:col-span-7 glass-panel rounded-2xl p-6 flex flex-col justify-between">
      <div>
        <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wider mb-6 flex items-center justify-between">
          <span>Benchmark Results & Data Integrity Report</span>
          {lastResults && (
            <span className="text-xs font-mono text-emerald-400">Completed in {lastResults.durationMs}ms</span>
          )}
        </h3>

        <StockStatusCard item={currentItem} />

        {isSimulating && (
          <div className="space-y-2 mb-6">
            <div className="flex justify-between text-xs font-mono text-slate-400">
              <span>Executing Parallel Order Requests...</span>
              <span>{Math.round((progress.completed / progress.total) * 100)}%</span>
            </div>
            <div className="h-2.5 w-full bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-cyan-500 to-amber-500 transition-all duration-150"
                style={{ width: `${(progress.completed / progress.total) * 100}%` }}
              ></div>
            </div>
          </div>
        )}

        {lastResults ? (
          <div className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800">
                <span className="text-slate-400 text-[11px] font-mono">Parallel Requests</span>
                <div className="text-xl font-bold font-mono text-slate-100 mt-1">{lastResults.concurrentRequests}</div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800">
                <span className="text-slate-400 text-[11px] font-mono">Successful Orders</span>
                <div className="text-xl font-bold font-mono text-emerald-400 mt-1">{lastResults.successes}</div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800">
                <span className="text-slate-400 text-[11px] font-mono">Out of Stock Rejections</span>
                <div className="text-xl font-bold font-mono text-amber-400 mt-1">{lastResults.failures}</div>
              </div>

              <div
                className={`p-3.5 rounded-xl border ${
                  lastResults.oversoldUnits > 0
                    ? 'bg-rose-950/40 border-rose-500/60 shadow-lg shadow-rose-500/20'
                    : 'bg-emerald-950/20 border-emerald-500/30'
                }`}
              >
                <span className="text-slate-400 text-[11px] font-mono">Oversold Units</span>
                <div
                  className={`text-xl font-bold font-mono mt-1 ${
                    lastResults.oversoldUnits > 0 ? 'text-rose-400 text-glow-rose' : 'text-emerald-400'
                  }`}
                >
                  {lastResults.oversoldUnits} units
                </div>
              </div>
            </div>

            <div
              className={`p-4 rounded-xl border flex items-start space-x-3 ${
                lastResults.oversoldUnits > 0
                  ? 'bg-rose-500/10 border-rose-500/30 text-rose-200'
                  : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
              }`}
            >
              {lastResults.oversoldUnits > 0 ? (
                <AlertOctagon className="h-6 w-6 text-rose-400 flex-shrink-0 mt-0.5" />
              ) : (
                <CheckCircle className="h-6 w-6 text-emerald-400 flex-shrink-0 mt-0.5" />
              )}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider mb-1">
                  {lastResults.oversoldUnits > 0
                    ? 'CRITICAL RACE CONDITION DETECTED (Overselling Occurred)'
                    : 'ZERO OVERSELLING GUARANTEED (Strict Concurrency Control)'}
                </h4>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {lastResults.oversoldUnits > 0
                    ? `Without synchronization locks, multiple concurrent requests read stock as available simultaneously. ${lastResults.successes} orders were placed for only ${lastResults.initialStock} available items, resulting in ${lastResults.oversoldUnits} negative inventory oversold items!`
                    : `Under ${lastResults.lockStrategy} strategy, exact stock boundaries were enforced. Exactly ${lastResults.successes} orders succeeded (matching stock capacity of ${lastResults.initialStock}) and remaining requests were rejected safely.`}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="h-64 flex flex-col items-center justify-center border border-dashed border-slate-800 rounded-xl text-center p-6 text-slate-500">
            <Box className="h-10 w-10 text-slate-700 mb-2" />
            <p className="text-sm font-medium text-slate-400">Ready for Flash Sale Simulation</p>
            <p className="text-xs text-slate-500 mt-1">
              Configure stock and user threads on the left, then click "Launch Flash Sale Stress Test".
            </p>
          </div>
        )}
      </div>

      <div className="pt-4 border-t border-slate-800/80 mt-6 flex items-center justify-between text-xs font-mono text-slate-500">
        <span>Global Lock Manager Contention Count: {contentionCount}</span>
        <span>Redlock Mutex Algorithm</span>
      </div>
    </div>
  );
}
