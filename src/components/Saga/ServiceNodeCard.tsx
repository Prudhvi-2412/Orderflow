import React from 'react';
import { LucideIcon } from 'lucide-react';

export interface ServiceNodeCardProps {
  name: string;
  description: string;
  badge: string;
  topic: string;
  port: string;
  icon: LucideIcon;
  isActive: boolean;
  themeColor?: 'cyan' | 'purple' | 'emerald' | 'amber';
}

export function ServiceNodeCard({
  name,
  description,
  badge,
  topic,
  port,
  icon: Icon,
  isActive,
  themeColor = 'cyan'
}: ServiceNodeCardProps) {
  const colorStyles = {
    cyan: { active: 'bg-cyan-950/40 border-cyan-400 shadow-lg shadow-cyan-500/20 scale-105', icon: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20', port: 'text-cyan-400' },
    purple: { active: 'bg-purple-950/40 border-purple-400 shadow-lg shadow-purple-500/20 scale-105', icon: 'bg-purple-500/10 text-purple-400 border-purple-500/20', port: 'text-purple-400' },
    emerald: { active: 'bg-emerald-950/40 border-emerald-400 shadow-lg shadow-emerald-500/20 scale-105', icon: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', port: 'text-emerald-400' },
    amber: { active: 'bg-amber-950/40 border-amber-400 shadow-lg shadow-amber-500/20 scale-105', icon: 'bg-amber-500/10 text-amber-400 border-amber-500/20', port: 'text-amber-400' }
  };

  const currentTheme = colorStyles[themeColor] || colorStyles.cyan;

  return (
    <div
      className={`p-4 rounded-xl border transition-all duration-300 relative ${
        isActive ? currentTheme.active : 'bg-slate-900/60 border-slate-800'
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <span className={`p-2 rounded-lg border ${currentTheme.icon}`}>
          <Icon className="h-5 w-5" />
        </span>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400">{badge}</span>
      </div>
      <h4 className="font-semibold text-slate-200 text-sm">{name}</h4>
      <p className="text-xs text-slate-400 mt-1">{description}</p>
      <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono text-slate-400">
        <span>Topic: {topic}</span>
        <span className={currentTheme.port}>Port: {port}</span>
      </div>
    </div>
  );
}
