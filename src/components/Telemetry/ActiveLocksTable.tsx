import React from 'react';
import { Lock } from 'lucide-react';
import { LockInfo } from '../../core/LockManager.js';

export interface ActiveLocksTableProps {
  activeLocks: LockInfo[];
}

export function ActiveLocksTable({ activeLocks }: ActiveLocksTableProps) {
  return (
    <div className="lg:col-span-6 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
      <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
        <Lock className="h-4 w-4 text-amber-600" />
        Active Distributed Mutex Lease Locks ({activeLocks.length})
      </h3>

      {activeLocks.length === 0 ? (
        <div className="p-8 text-center border border-dashed border-slate-200 rounded-xl text-slate-400 bg-slate-50/50">
          <p className="text-xs font-mono text-slate-600 font-semibold">No active locks currently held.</p>
          <p className="text-[11px] text-slate-500 mt-1">Locks auto-release upon transaction completion or TTL expiration.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 text-[11px]">
                <th className="pb-2">Resource Key</th>
                <th className="pb-2">Fence Token</th>
                <th className="pb-2">Owner ID</th>
                <th className="pb-2 text-right">TTL Remaining</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {activeLocks.map((l) => (
                <tr key={l.resourceKey} className="hover:bg-slate-50">
                  <td className="py-2.5 text-blue-700 font-bold">{l.resourceKey}</td>
                  <td className="py-2.5 text-amber-700">#{l.fenceToken}</td>
                  <td className="py-2.5 text-slate-500 text-[11px]">{l.ownerId}</td>
                  <td className="py-2.5 text-right font-bold text-emerald-700">{l.remainingTtl} ms</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
