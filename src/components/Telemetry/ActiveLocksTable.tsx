import React from 'react';
import { Lock } from 'lucide-react';
import { LockInfo } from '../../core/LockManager.js';

export interface ActiveLocksTableProps {
  activeLocks: LockInfo[];
}

export function ActiveLocksTable({ activeLocks }: ActiveLocksTableProps) {
  return (
    <div className="lg:col-span-6 glass-panel rounded-2xl p-5">
      <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wider mb-4 flex items-center gap-2">
        <Lock className="h-4 w-4 text-amber-400" />
        Active Distributed Mutex Lease Locks ({activeLocks.length})
      </h3>

      {activeLocks.length === 0 ? (
        <div className="p-8 text-center border border-dashed border-slate-800 rounded-xl text-slate-500">
          <p className="text-xs font-mono">No active locks currently held.</p>
          <p className="text-[11px] text-slate-600 mt-1">Locks auto-release upon transaction completion or TTL expiration.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 text-[11px]">
                <th className="pb-2">Resource Key</th>
                <th className="pb-2">Fence Token</th>
                <th className="pb-2">Owner ID</th>
                <th className="pb-2 text-right">TTL Remaining</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {activeLocks.map((l) => (
                <tr key={l.resourceKey}>
                  <td className="py-2.5 text-cyan-400 font-bold">{l.resourceKey}</td>
                  <td className="py-2.5 text-amber-400">#{l.fenceToken}</td>
                  <td className="py-2.5 text-slate-400 text-[11px]">{l.ownerId}</td>
                  <td className="py-2.5 text-right font-bold text-emerald-400">{l.remainingTtl} ms</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
