import React from 'react';
import { AlertOctagon, Zap, Lock } from 'lucide-react';

export interface LockStrategySelectorProps {
  selectedStrategy: 'NONE' | 'OPTIMISTIC' | 'PESSIMISTIC';
  onChangeStrategy: (strategy: 'NONE' | 'OPTIMISTIC' | 'PESSIMISTIC') => void;
}

export function LockStrategySelector({ selectedStrategy, onChangeStrategy }: LockStrategySelectorProps) {
  const strategies = [
    {
      id: 'NONE' as const,
      title: 'NONE (Unsafe Race Condition)',
      description: 'Direct read-modify-write without synchronization. Demonstrates inventory overselling!',
      color: 'rose' as const,
      icon: AlertOctagon
    },
    {
      id: 'OPTIMISTIC' as const,
      title: 'OPTIMISTIC LOCKING (Version CAS)',
      description: 'Checks stock entity version on update. Rejects write on version mismatch. Zero overselling.',
      color: 'amber' as const,
      icon: Zap
    },
    {
      id: 'PESSIMISTIC' as const,
      title: 'PESSIMISTIC DISTRIBUTED MUTEX (Redlock)',
      description: 'Acquires distributed lock with lease TTL before stock check. Strict thread safety & zero overselling.',
      color: 'emerald' as const,
      icon: Lock
    }
  ];

  return (
    <div>
      <label className="block text-xs font-semibold text-slate-700 mb-2">Concurrency Lock Strategy</label>
      <div className="space-y-2">
        {strategies.map((strat) => {
          const Icon = strat.icon;
          const isSelected = selectedStrategy === strat.id;

          const themeStyles = {
            rose: isSelected
              ? 'bg-rose-50 border-rose-300 text-rose-900 shadow-sm'
              : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100/60',
            amber: isSelected
              ? 'bg-amber-50 border-amber-300 text-amber-900 shadow-sm'
              : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100/60',
            emerald: isSelected
              ? 'bg-emerald-50 border-emerald-300 text-emerald-900 shadow-sm'
              : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100/60'
          };

          const textColors = {
            rose: 'text-rose-700',
            amber: 'text-amber-800',
            emerald: 'text-emerald-800'
          };

          return (
            <label
              key={strat.id}
              className={`flex items-start p-3 rounded-xl border cursor-pointer transition ${themeStyles[strat.color]}`}
            >
              <input
                type="radio"
                name="lockStrategy"
                value={strat.id}
                checked={isSelected}
                onChange={() => onChangeStrategy(strat.id)}
                className="mt-1 accent-blue-600"
              />
              <div className="ml-3">
                <div className={`text-xs font-bold ${textColors[strat.color]} flex items-center gap-1.5`}>
                  <Icon className="h-4 w-4" />
                  {strat.title}
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">{strat.description}</p>
              </div>
            </label>
          );
        })}
      </div>
    </div>
  );
}
