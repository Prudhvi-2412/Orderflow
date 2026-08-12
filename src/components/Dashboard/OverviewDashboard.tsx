import React from 'react';
import {
  ShoppingCart,
  CheckCircle,
  Clock,
  Zap,
  Activity,
  Users,
  AlertTriangle,
  Inbox,
  TrendingUp,
  TrendingDown,
  Server,
  Database,
  RefreshCw,
  LucideIcon
} from 'lucide-react';

export interface KpiItem {
  title: string;
  value: string;
  trend: string;
  isPositive: boolean;
  subtext: string;
  icon: LucideIcon;
  sparkline: number[];
}

export interface ServiceHealthItem {
  name: string;
  status: 'HEALTHY' | 'WARNING' | 'DOWN';
  latencyMs: number;
  requests: number;
  type: string;
}

export function OverviewDashboard() {
  const kpis: KpiItem[] = [
    {
      title: 'Orders Processed',
      value: '12,842',
      trend: '↑ 12.4%',
      isPositive: true,
      subtext: 'vs last 24h',
      icon: ShoppingCart,
      sparkline: [40, 55, 60, 75, 90, 85, 110]
    },
    {
      title: 'Success Rate',
      value: '99.92%',
      trend: '↑ 0.15%',
      isPositive: true,
      subtext: 'Saga completion',
      icon: CheckCircle,
      sparkline: [98, 99, 99.5, 99.8, 99.9, 99.92]
    },
    {
      title: 'Average Latency',
      value: '28 ms',
      trend: '↓ 4.2 ms',
      isPositive: true,
      subtext: 'End-to-end Saga',
      icon: Clock,
      sparkline: [45, 38, 32, 29, 28, 28]
    },
    {
      title: 'P95 Latency',
      value: '142 ms',
      trend: '↓ 12 ms',
      isPositive: true,
      subtext: 'High concurrency',
      icon: Zap,
      sparkline: [180, 165, 150, 142, 142]
    },
    {
      title: 'Kafka Events/sec',
      value: '1,420 rps',
      trend: '↑ 18.5%',
      isPositive: true,
      subtext: 'Outbox event stream',
      icon: Activity,
      sparkline: [900, 1100, 1250, 1380, 1420]
    },
    {
      title: 'Active Consumers',
      value: '16 Workers',
      trend: 'Optimal',
      isPositive: true,
      subtext: 'Across partitions',
      icon: Users,
      sparkline: [16, 16, 16, 16, 16]
    },
    {
      title: 'Failed Events (DLQ)',
      value: '3 Items',
      trend: '↓ 50%',
      isPositive: true,
      subtext: 'Pending operator redrive',
      icon: AlertTriangle,
      sparkline: [10, 8, 5, 3, 3]
    },
    {
      title: 'Queue Depth',
      value: '42 Msg',
      trend: 'Normal',
      isPositive: true,
      subtext: 'RabbitMQ notification',
      icon: Inbox,
      sparkline: [20, 35, 42, 40, 42]
    }
  ];

  const serviceHealthList: ServiceHealthItem[] = [
    { name: 'Order Service', status: 'HEALTHY', latencyMs: 14, requests: 1248, type: 'REST / Saga Orchestrator' },
    { name: 'Inventory Service', status: 'HEALTHY', latencyMs: 18, requests: 1248, type: 'Redis Redlock Mutex' },
    { name: 'Payment Service', status: 'HEALTHY', latencyMs: 42, requests: 1240, type: 'Circuit Breaker Protected' },
    { name: 'Fulfillment Service', status: 'HEALTHY', latencyMs: 22, requests: 1238, type: 'Shipping Dispatcher' },
    { name: 'Notification Worker', status: 'HEALTHY', latencyMs: 9, requests: 2490, type: 'RabbitMQ Consumer' },
    { name: 'Kafka Cluster', status: 'HEALTHY', latencyMs: 4, requests: 8420, type: 'Event Mesh Broker' },
    { name: 'RabbitMQ Broker', status: 'HEALTHY', latencyMs: 6, requests: 3100, type: 'AMQP Task Exchange' },
    { name: 'Redis Cache & Mutex', status: 'HEALTHY', latencyMs: 2, requests: 14200, type: 'Redlock Lock Manager' },
    { name: 'PostgreSQL DB', status: 'HEALTHY', latencyMs: 8, requests: 9400, type: 'ACID Outbox Storage' }
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Distributed System Overview</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 border border-emerald-200">
              ● All Systems Operational
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Real-time health, event processing, and latency metrics across the OrderFlow platform.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button className="flex items-center space-x-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition">
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Auto Refresh (1s)</span>
          </button>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi, idx) => {
          const Icon = kpi.icon;
          return (
            <div key={idx} className="card-enterprise-hover p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{kpi.title}</span>
                <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
                  <Icon className="h-4.5 w-4.5" />
                </div>
              </div>

              <div className="mt-3 flex items-baseline justify-between">
                <span className="text-2xl font-extrabold text-slate-900 tracking-tight font-mono">{kpi.value}</span>
                <span
                  className={`text-xs font-bold flex items-center gap-0.5 ${
                    kpi.isPositive ? 'text-emerald-600' : 'text-rose-600'
                  }`}
                >
                  {kpi.trend.includes('↑') ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  {kpi.trend}
                </span>
              </div>

              <div className="mt-3 flex items-center justify-between pt-3 border-t border-slate-100 text-[11px] text-slate-400">
                <span>{kpi.subtext}</span>
                {/* SVG Sparkline */}
                <svg className="w-16 h-5 stroke-blue-500 fill-none" viewBox="0 0 100 30">
                  <path
                    d="M 0 25 L 20 18 L 40 20 L 60 10 L 80 15 L 100 5"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
            </div>
          );
        })}
      </div>

      {/* Service Health Grid */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-base font-bold text-slate-900 tracking-tight">Live Microservices & Infrastructure Health</h2>
            <p className="text-xs text-slate-500 mt-0.5">Automated heartbeat monitoring across isolated nodes</p>
          </div>
          <span className="text-xs font-mono text-slate-400">9 Nodes Monitored</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {serviceHealthList.map((srv, idx) => (
            <div key={idx} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white hover:shadow-md transition">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                  </span>
                  <h3 className="font-bold text-slate-900 text-sm">{srv.name}</h3>
                </div>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-700">
                  HEALTHY
                </span>
              </div>

              <p className="text-xs text-slate-500">{srv.type}</p>

              <div className="mt-3 pt-3 border-t border-slate-200 flex items-center justify-between text-xs font-mono">
                <span className="text-slate-500">Latency: <strong className="text-slate-900">{srv.latencyMs} ms</strong></span>
                <span className="text-slate-500">Req/min: <strong className="text-blue-600">{srv.requests}</strong></span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
