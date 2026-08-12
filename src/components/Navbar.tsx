import React from 'react';
import {
  Zap,
  GitMerge,
  ShieldAlert,
  Activity,
  Repeat,
  BookOpen,
  PlusCircle,
  Flame,
  LucideIcon
} from 'lucide-react';

export interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onQuickOrder: () => void;
  onQuickFlashSale: () => void;
}

export function Navbar({ activeTab, setActiveTab, onQuickOrder, onQuickFlashSale }: NavbarProps) {
  const tabs: { id: string; label: string; icon: LucideIcon }[] = [
    { id: 'saga', label: 'Saga Visualizer', icon: GitMerge },
    { id: 'concurrency', label: 'Concurrency & Locks', icon: Flame },
    { id: 'idempotency', label: 'Idempotency Lab', icon: Repeat },
    { id: 'resilience', label: 'Resilience & DLQ', icon: ShieldAlert },
    { id: 'telemetry', label: 'Telemetry & Bus', icon: Activity },
    { id: 'architecture', label: 'Architecture Docs', icon: BookOpen }
  ];

  return (
    <header className="sticky top-0 z-50 bg-slate-950/80 backdrop-blur-xl border-b border-slate-800/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setActiveTab('saga')}>
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-cyan-500 via-indigo-500 to-purple-600 p-0.5 shadow-lg shadow-cyan-500/20">
              <div className="h-full w-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <Zap className="h-5 w-5 text-cyan-400 fill-cyan-400/20 animate-pulse" />
              </div>
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-cyan-400 via-indigo-300 to-purple-400 bg-clip-text text-transparent">
                  OrderFlow
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shimmer-badge">
                  v1.0 DISTRIBUTED
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono">Event-Driven Engine</p>
            </div>
          </div>

          <nav className="hidden md:flex space-x-1 bg-slate-900/60 p-1 rounded-xl border border-slate-800">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 ${
                    isActive
                      ? 'bg-gradient-to-r from-cyan-500/20 to-indigo-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm shadow-cyan-500/10'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                  }`}
                >
                  <Icon className={`h-4 w-4 ${isActive ? 'text-cyan-400' : 'text-slate-400'}`} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="flex items-center space-x-2">
            <button
              onClick={onQuickOrder}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 transition-all shadow-sm"
            >
              <PlusCircle className="h-4 w-4" />
              <span className="hidden sm:inline">New Order</span>
            </button>

            <button
              onClick={onQuickFlashSale}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-amber-500 to-rose-600 text-white hover:from-amber-400 hover:to-rose-500 transition-all shadow-md shadow-amber-500/20"
            >
              <Flame className="h-4 w-4 animate-bounce" />
              <span>Simulate Flash Sale</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
