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
      title: 'NONE (No Concurrency Control)',
      description: 'Direct read-modify-write without sync. Demonstrates Race Conditions & Overselling!',
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
      <label className="block text-xs font-medium text-slate-400 mb-2">Concurrency Control Strategy</label>
      <div className="space-y-2">
        {strategies.map((strat) => {
          const Icon = strat.icon;
          const isSelected = selectedStrategy === strat.id;

          const themeStyles = {
            rose: isSelected
              ? 'bg-rose-950/30 border-rose-500/50 text-slate-100'
              : 'bg-slate-900/40 border-slate-800 text-slate-400 hover:bg-slate-800/40',
            amber: isSelected
              ? 'bg-amber-950/30 border-amber-500/50 text-slate-100'
              : 'bg-slate-900/40 border-slate-800 text-slate-400 hover:bg-slate-800/40',
            emerald: isSelected
              ? 'bg-emerald-950/30 border-emerald-500/50 text-slate-100'
              : 'bg-slate-900/40 border-slate-800 text-slate-400 hover:bg-slate-800/40'
          };

          const textColors = {
            rose: 'text-rose-400',
            amber: 'text-amber-400',
            emerald: 'text-emerald-400'
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
                className="mt-1 accent-cyan-500"
              />
              <div className="ml-3">
                <div className={`text-xs font-bold ${textColors[strat.color]} flex items-center gap-1.5`}>
                  <Icon className="h-4 w-4" />
                  {strat.title}
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">{strat.description}</p>
              </div>
            </label>
          );
        })}
      </div>
    </div>
  );
}
