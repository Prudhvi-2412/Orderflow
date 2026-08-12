import React from 'react';
import { LucideIcon } from 'lucide-react';

export interface HeaderBannerProps {
  icon?: LucideIcon;
  tag?: string;
  title: string;
  description?: string;
  color?: 'cyan' | 'purple' | 'amber' | 'rose' | 'emerald';
  actionButton?: React.ReactNode;
}

export function HeaderBanner({
  icon: Icon,
  tag,
  title,
  description,
  color = 'cyan',
  actionButton = null
}: HeaderBannerProps) {
  const colorMap = {
    cyan: { tag: 'text-cyan-400', glow: 'bg-cyan-500/10' },
    purple: { tag: 'text-purple-400', glow: 'bg-purple-500/10' },
    amber: { tag: 'text-amber-400', glow: 'bg-amber-500/10' },
    rose: { tag: 'text-rose-400', glow: 'bg-rose-500/10' },
    emerald: { tag: 'text-emerald-400', glow: 'bg-emerald-500/10' }
  };

  const theme = colorMap[color] || colorMap.cyan;

  return (
    <div className="glass-panel rounded-2xl p-6 relative overflow-hidden">
      <div className={`absolute top-0 right-0 w-96 h-96 ${theme.glow} rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none`}></div>
      <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          {tag && (
            <div className={`flex items-center space-x-2 ${theme.tag} font-mono text-xs font-semibold uppercase tracking-wider mb-1`}>
              {Icon && <Icon className="h-4 w-4" />}
              <span>{tag}</span>
            </div>
          )}
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            {!tag && Icon && <Icon className={`h-6 w-6 ${theme.tag}`} />}
            {title}
          </h2>
          {description && (
            <p className="text-sm text-slate-400 mt-1 max-w-3xl leading-relaxed">
              {description}
            </p>
          )}
        </div>
        {actionButton && <div className="flex-shrink-0">{actionButton}</div>}
      </div>
    </div>
  );
}
