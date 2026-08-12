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
    cyan: { icon: 'bg-blue-50 text-blue-600 border-blue-200', chevron: 'text-blue-600' },
    purple: { icon: 'bg-indigo-50 text-indigo-600 border-indigo-200', chevron: 'text-indigo-600' },
    emerald: { icon: 'bg-emerald-50 text-emerald-600 border-emerald-200', chevron: 'text-emerald-600' },
    rose: { icon: 'bg-rose-50 text-rose-600 border-rose-200', chevron: 'text-rose-600' }
  };

  const theme = themeStyles[color] || themeStyles.cyan;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
      <button
        onClick={() => onToggle(id)}
        className="w-full p-5 flex items-center justify-between text-left hover:bg-slate-50 transition"
      >
        <div className="flex items-center space-x-3">
          <div className={`p-2 rounded-xl border ${theme.icon}`}>
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-sm">{title}</h3>
            <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
          </div>
        </div>
        {isOpen ? <ChevronDown className={`h-5 w-5 ${theme.chevron}`} /> : <ChevronRight className="h-5 w-5 text-slate-400" />}
      </button>

      {isOpen && (
        <div className="p-5 pt-0 border-t border-slate-100 text-xs text-slate-700 space-y-3 leading-relaxed">
          {children}
        </div>
      )}
    </div>
  );
}
