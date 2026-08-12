import React from 'react';
import {
  LayoutDashboard,
  ShoppingCart,
  GitMerge,
  Server,
  Activity,
  Package,
  CreditCard,
  ShieldAlert,
  Inbox,
  BarChart3,
  Flame,
  Network,
  ChevronLeft,
  ChevronRight,
  Bot,
  LucideIcon
} from 'lucide-react';

export interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
}

export interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  badge?: string;
}

export function Sidebar({ activeTab, setActiveTab, isCollapsed, setIsCollapsed }: SidebarProps) {
  const navItems: NavItem[] = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'mcp', label: 'AI Operations', icon: Bot, badge: 'MCP' },
    { id: 'orders', label: 'Orders', icon: ShoppingCart },
    { id: 'saga', label: 'Saga Orchestrator', icon: GitMerge },
    { id: 'services', label: 'Services', icon: Server },
    { id: 'kafka', label: 'Kafka Events', icon: Activity, badge: 'LIVE' },
    { id: 'inventory', label: 'Inventory Lab', icon: Package },
    { id: 'idempotency', label: 'Idempotency Lab', icon: CreditCard },
    { id: 'resilience', label: 'Resilience & DLQ', icon: ShieldAlert },
    { id: 'observability', label: 'Observability', icon: BarChart3 },
    { id: 'loadtesting', label: 'Load Testing', icon: Flame },
    { id: 'architecture', label: 'Architecture', icon: Network }
  ];

  return (
    <aside
      className={`bg-white border-r border-slate-200 min-h-[calc(100vh-4rem)] transition-all duration-300 flex flex-col relative ${
        isCollapsed ? 'w-16' : 'w-64'
      }`}
    >
      {/* Toggle Button */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute -right-3 top-6 bg-white border border-slate-200 rounded-full p-1 text-slate-500 hover:text-slate-900 shadow-sm z-30 transition"
      >
        {isCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
      </button>

      {/* Navigation List */}
      <div className="p-3 space-y-1 flex-1 overflow-y-auto">
        {!isCollapsed && (
          <p className="px-3 py-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            Control Plane
          </p>
        )}

        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              title={isCollapsed ? item.label : undefined}
              className={`w-full flex items-center ${
                isCollapsed ? 'justify-center px-0' : 'justify-between px-3'
              } py-2.5 rounded-lg text-xs font-semibold transition-all relative ${
                isActive
                  ? 'bg-blue-50 text-blue-700 border-l-4 border-blue-600 font-bold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 border-l-4 border-transparent'
              }`}
            >
              <div className="flex items-center space-x-3">
                <Icon className={`h-4.5 w-4.5 ${isActive ? 'text-blue-600' : 'text-slate-500'}`} />
                {!isCollapsed && <span>{item.label}</span>}
              </div>

              {!isCollapsed && item.badge && (
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Footer System Status */}
      {!isCollapsed && (
        <div className="p-3 m-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] font-mono text-slate-500">
          <div className="flex items-center justify-between mb-1">
            <span>Kafka Mesh:</span>
            <span className="text-emerald-600 font-bold">CONNECTED</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Redlock Redis:</span>
            <span className="text-emerald-600 font-bold">READY</span>
          </div>
        </div>
      )}
    </aside>
  );
}
