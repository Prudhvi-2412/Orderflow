import React from 'react';
import { ChevronDown, ChevronRight, LucideIcon } from 'lucide-react';

export interface ArchitectureAccordionItemProps {
  id: string;
  icon: LucideIcon;
  title: string;
  subtitle: string;
  color?: 'cyan' | 'purple' | 'emerald' | 'rose';
  isOpen: boolean;
  onToggle: (id: string) => void;
  children: React.ReactNode;
}

export function ArchitectureAccordionItem({
  id,
  icon: Icon,
  title,
  subtitle,
  color = 'cyan',
  isOpen,
  onToggle,
  children
}: ArchitectureAccordionItemProps) {
  const themeStyles = {
    cyan: { icon: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20', chevron: 'text-cyan-400' },
    purple: { icon: 'bg-purple-500/10 text-purple-400 border-purple-500/20', chevron: 'text-purple-400' },
    emerald: { icon: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', chevron: 'text-emerald-400' },
    rose: { icon: 'bg-rose-500/10 text-rose-400 border-rose-500/20', chevron: 'text-rose-400' }
  };

  const theme = themeStyles[color] || themeStyles.cyan;

  return (
    <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden">
      <button
        onClick={() => onToggle(id)}
        className="w-full p-5 flex items-center justify-between text-left hover:bg-slate-800/40 transition"
      >
        <div className="flex items-center space-x-3">
          <div className={`p-2 rounded-xl border ${theme.icon}`}>
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-bold text-slate-100 text-sm">{title}</h3>
            <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>
          </div>
        </div>
        {isOpen ? <ChevronDown className={`h-5 w-5 ${theme.chevron}`} /> : <ChevronRight className="h-5 w-5 text-slate-500" />}
      </button>

      {isOpen && (
        <div className="p-5 pt-0 border-t border-slate-800/80 text-xs text-slate-300 space-y-3 leading-relaxed">
          {children}
        </div>
      )}
    </div>
  );
}
