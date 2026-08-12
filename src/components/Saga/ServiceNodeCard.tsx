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
  themeColor?: 'cyan' | 'purple' | 'emerald' | 'amber' | 'sky';
}

export function ServiceNodeCard({
  name,
  description,
  badge,
  topic,
  port,
  icon: Icon,
  isActive,
  themeColor = 'sky'
}: ServiceNodeCardProps) {
  const colorStyles = {
    sky: { 
      active: 'bg-sky-950/60 border-sky-400 shadow-xl shadow-sky-500/30 scale-105 ring-2 ring-sky-400/40', 
      icon: 'bg-sky-500/20 text-sky-300 border-sky-400/40 shadow-inner', 
      port: 'text-sky-300 font-bold',
      badge: 'bg-sky-500/10 text-sky-300 border-sky-400/30'
    },
    cyan: { 
      active: 'bg-cyan-950/60 border-cyan-400 shadow-xl shadow-cyan-500/30 scale-105 ring-2 ring-cyan-400/40', 
      icon: 'bg-cyan-500/20 text-cyan-300 border-cyan-400/40', 
      port: 'text-cyan-300 font-bold',
      badge: 'bg-cyan-500/10 text-cyan-300 border-cyan-400/30'
    },
    purple: { 
      active: 'bg-purple-950/60 border-purple-400 shadow-xl shadow-purple-500/30 scale-105 ring-2 ring-purple-400/40', 
      icon: 'bg-purple-500/20 text-purple-300 border-purple-400/40', 
      port: 'text-purple-300 font-bold',
      badge: 'bg-purple-500/10 text-purple-300 border-purple-400/30'
    },
    emerald: { 
      active: 'bg-emerald-950/60 border-emerald-400 shadow-xl shadow-emerald-500/30 scale-105 ring-2 ring-emerald-400/40', 
      icon: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40', 
      port: 'text-emerald-300 font-bold',
      badge: 'bg-emerald-500/10 text-emerald-300 border-emerald-400/30'
    },
    amber: { 
      active: 'bg-amber-950/60 border-amber-400 shadow-xl shadow-amber-500/30 scale-105 ring-2 ring-amber-400/40', 
      icon: 'bg-amber-500/20 text-amber-300 border-amber-400/40', 
      port: 'text-amber-300 font-bold',
      badge: 'bg-amber-500/10 text-amber-300 border-amber-400/30'
    }
  };

  const currentTheme = colorStyles[themeColor] || colorStyles.sky;

  return (
    <div
      className={`p-4 rounded-2xl border transition-all duration-300 relative group glass-panel-interactive ${
        isActive ? currentTheme.active : 'bg-slate-900/50 border-sky-500/15 hover:border-sky-400/40'
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <span className={`p-2.5 rounded-xl border ${currentTheme.icon} transition-transform duration-300 group-hover:scale-110`}>
          <Icon className="h-5 w-5" />
        </span>
        <span className={`text-[10px] font-mono px-2.5 py-0.5 rounded-full border ${currentTheme.badge} font-semibold`}>
          {badge}
        </span>
      </div>

      <h4 className="font-bold text-slate-100 text-sm tracking-tight">{name}</h4>
      <p className="text-xs text-slate-300 mt-1 leading-normal">{description}</p>

      <div className="mt-3.5 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono text-slate-400">
        <span>Topic: <strong className="text-slate-200">{topic}</strong></span>
        <span className={currentTheme.port}>Port: {port}</span>
      </div>
    </div>
  );
}
