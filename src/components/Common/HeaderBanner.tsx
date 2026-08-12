import React from 'react';
import { LucideIcon } from 'lucide-react';

export interface HeaderBannerProps {
  icon?: LucideIcon;
  tag?: string;
  title: string;
  description?: string;
  color?: 'cyan' | 'purple' | 'amber' | 'rose' | 'emerald' | 'sky';
  actionButton?: React.ReactNode;
}

export function HeaderBanner({
  icon: Icon,
  tag,
  title,
  description,
  color = 'sky',
  actionButton = null
}: HeaderBannerProps) {
  return (
    <div className="bg-white rounded-2xl p-6 relative overflow-hidden border border-slate-200 shadow-xs">
      <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          {tag && (
            <div className="flex items-center space-x-2 text-blue-700 font-mono text-xs font-bold uppercase tracking-wider mb-1.5">
              {Icon && <Icon className="h-4 w-4" />}
              <span>{tag}</span>
            </div>
          )}
          <h2 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2.5 tracking-tight">
            {!tag && Icon && <Icon className="h-6 w-6 text-blue-600" />}
            {title}
          </h2>
          {description && (
            <p className="text-sm text-slate-500 mt-1.5 max-w-3xl leading-relaxed">
              {description}
            </p>
          )}
        </div>
        {actionButton && <div className="flex-shrink-0">{actionButton}</div>}
      </div>
    </div>
  );
}
