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
    <header className="sticky top-0 z-50 bg-slate-950/80 backdrop-blur-2xl border-b border-sky-500/20 shadow-lg shadow-sky-950/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Brand Logo */}
          <div className="flex items-center space-x-3 cursor-pointer group" onClick={() => setActiveTab('saga')}>
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-sky-500 via-cyan-400 to-indigo-500 p-0.5 shadow-lg shadow-sky-500/30 group-hover:shadow-sky-400/50 transition-all duration-300 transform group-hover:scale-105">
              <div className="h-full w-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <Zap className="h-5 w-5 text-sky-400 fill-sky-400/20 animate-pulse" />
              </div>
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-extrabold text-xl tracking-tight bg-gradient-to-r from-sky-400 via-cyan-300 to-indigo-300 bg-clip-text text-transparent drop-shadow-sm">
                  OrderFlow
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-300 border border-sky-400/30 shimmer-badge-skyblue shadow-inner">
                  v1.0 DISTRIBUTED
                </span>
              </div>
              <p className="text-xs text-sky-400/70 font-mono tracking-wide">Event-Driven Engine</p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="hidden md:flex space-x-1.5 bg-slate-900/70 p-1.5 rounded-2xl border border-sky-500/20 shadow-inner">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200 ${
                    isActive
                      ? 'bg-gradient-to-r from-sky-500/25 to-cyan-500/20 text-sky-200 border border-sky-400/40 shadow-md shadow-sky-500/20 transform scale-[1.02]'
                      : 'text-slate-400 hover:text-sky-300 hover:bg-sky-500/10 hover:border hover:border-sky-500/20'
                  }`}
                >
                  <Icon className={`h-4 w-4 transition-transform duration-200 ${isActive ? 'text-sky-400 scale-110' : 'text-slate-400'}`} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Action Buttons */}
          <div className="flex items-center space-x-2.5">
            <button
              onClick={onQuickOrder}
              className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 border border-sky-400/30 hover:border-sky-400/60 transition-all shadow-md shadow-sky-500/10 transform hover:scale-105"
            >
              <PlusCircle className="h-4 w-4 text-sky-400" />
              <span className="hidden sm:inline">New Order</span>
            </button>

            <button
              onClick={onQuickFlashSale}
              className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-amber-500 via-orange-500 to-rose-600 text-white hover:from-amber-400 hover:to-rose-500 transition-all shadow-lg shadow-amber-500/25 transform hover:scale-105 active:scale-95"
            >
              <Flame className="h-4 w-4 animate-bounce text-amber-200" />
              <span>Simulate Flash Sale</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
