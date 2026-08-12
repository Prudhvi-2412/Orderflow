import React, { useState, useEffect } from 'react';
import {
  Server,
  Activity,
  Database,
  Layers,
  Zap,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
  X,
  Radio,
  Cpu,
  Workflow
} from 'lucide-react';
import { HeaderBanner } from '../Common/HeaderBanner.js';

export interface ServiceDetail {
  [key: string]: any;
}

export interface ServiceHealthItem {
  id: string;
  name: string;
  status: 'HEALTHY' | 'DEGRADED' | 'DOWN' | 'UNKNOWN';
  latencyMs: number;
  requestsCount: number;
  uptime: string;
  mode: 'REAL' | 'SIMULATED' | 'UNAVAILABLE';
  lastChecked: string;
  details: ServiceDetail;
}

export function ServicesPage() {
  const [services, setServices] = useState<ServiceHealthItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [selectedService, setSelectedService] = useState<ServiceHealthItem | null>(null);

  const fetchServiceHealth = async () => {
    setIsLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch('http://localhost:4000/api/services/health');
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: Failed to load service health`);
      }
      const data = await res.json();
      if (data && Array.isArray(data.services)) {
        setServices(data.services);
      } else {
        throw new Error('Invalid payload received from backend health API');
      }
    } catch (err: any) {
      console.warn('Backend API service health fetch error:', err.message);
      setErrorMsg('Check whether the OrderFlow backend is running.');
      // Use client-side fallback data so page NEVER renders blank!
      setServices(getFallbackServiceHealth());
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchServiceHealth();
    const interval = setInterval(() => {
      fetchServiceHealth();
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const getFallbackServiceHealth = (): ServiceHealthItem[] => [
    {
      id: 'order-service',
      name: 'Order Service',
      status: 'HEALTHY',
      latencyMs: 24,
      requestsCount: 1248,
      uptime: '99.9%',
      mode: 'SIMULATED',
      lastChecked: '2 seconds ago',
      details: {
        type: 'Microservice',
        endpoint: '/api/orders',
        protocol: 'HTTP / REST',
        framework: 'Express + Saga Orchestrator',
        activeTransactions: 4,
        recentErrors: 0
      }
    },
    {
      id: 'inventory-service',
      name: 'Inventory Service',
      status: 'HEALTHY',
      latencyMs: 14,
      requestsCount: 3890,
      uptime: '99.95%',
      mode: 'SIMULATED',
      lastChecked: '1 second ago',
      details: {
        type: 'Microservice',
        endpoint: '/api/inventory',
        lockingStrategy: 'Redlock Mutex / Version CAS',
        table: 'inventory',
        recentErrors: 0
      }
    },
    {
      id: 'payment-service',
      name: 'Payment Service',
      status: 'HEALTHY',
      latencyMs: 65,
      requestsCount: 1120,
      uptime: '99.8%',
      mode: 'SIMULATED',
      lastChecked: '3 seconds ago',
      details: {
        type: 'Microservice',
        circuitBreaker: 'ACTIVE (Threshold 30%)',
        gateway: 'Stripe Mock Adapter',
        recentErrors: 1
      }
    },
    {
      id: 'fulfillment-service',
      name: 'Fulfillment Service',
      status: 'HEALTHY',
      latencyMs: 32,
      requestsCount: 940,
      uptime: '99.9%',
      mode: 'SIMULATED',
      lastChecked: '5 seconds ago',
      details: {
        type: 'Microservice',
        carrierIntegration: 'FedEx / UPS Async Outbox',
        queue: 'fulfillment_queue',
        recentErrors: 0
      }
    },
    {
      id: 'notification-worker',
      name: 'Notification Worker',
      status: 'HEALTHY',
      latencyMs: 9,
      requestsCount: 2150,
      uptime: '99.99%',
      mode: 'SIMULATED',
      lastChecked: '1 second ago',
      details: {
        type: 'Worker Process',
        broker: 'RabbitMQ Consumer',
        queue: 'order_notifications',
        recentErrors: 0
      }
    },
    {
      id: 'kafka',
      name: 'Kafka Event Mesh',
      status: 'HEALTHY',
      latencyMs: 6,
      requestsCount: 14500,
      uptime: '99.99%',
      mode: 'SIMULATED',
      lastChecked: 'Just now',
      details: {
        type: 'Event Streaming Broker',
        cluster: 'localhost:9092',
        topics: ['OrderCreated', 'InventoryReserved', 'PaymentProcessed', 'OrderFailed'],
        partitions: 4,
        consumerGroups: 3,
        recentErrors: 0
      }
    },
    {
      id: 'rabbitmq',
      name: 'RabbitMQ Broker',
      status: 'HEALTHY',
      latencyMs: 11,
      requestsCount: 8400,
      uptime: '99.95%',
      mode: 'SIMULATED',
      lastChecked: '2 seconds ago',
      details: {
        type: 'AMQP Message Broker',
        host: 'amqp://localhost:5672',
        exchanges: ['order_exchange'],
        queues: ['order_notifications', 'dlq_notifications'],
        recentErrors: 0
      }
    },
    {
      id: 'redis',
      name: 'Redis Mutex Engine',
      status: 'UNAVAILABLE',
      latencyMs: 0,
      requestsCount: 0,
      uptime: '0%',
      mode: 'UNAVAILABLE',
      lastChecked: 'Just now',
      details: {
        type: 'In-Memory Cache & Mutex Lock Manager',
        host: 'redis://localhost:6379',
        activeLocks: 0,
        recentErrors: 1
      }
    },
    {
      id: 'postgresql',
      name: 'PostgreSQL Database',
      status: 'UNAVAILABLE',
      latencyMs: 0,
      requestsCount: 0,
      uptime: '0%',
      mode: 'UNAVAILABLE',
      lastChecked: 'Just now',
      details: {
        type: 'Relational ACID Database',
        connection: 'Disconnected',
        pool: '0 / 20',
        latency: '0 ms',
        database: 'orderflow',
        lastQuery: 'SELECT 1',
        recentErrors: 1
      }
    }
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'HEALTHY':
        return (
          <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>HEALTHY</span>
          </div>
        );
      case 'DEGRADED':
        return (
          <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-extrabold bg-amber-100 text-amber-800 border border-amber-200">
            <span className="h-2 w-2 rounded-full bg-amber-500"></span>
            <span>DEGRADED</span>
          </div>
        );
      case 'DOWN':
        return (
          <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-extrabold bg-rose-100 text-rose-800 border border-rose-200">
            <span className="h-2 w-2 rounded-full bg-rose-500"></span>
            <span>DOWN</span>
          </div>
        );
      default:
        return (
          <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-extrabold bg-slate-100 text-slate-700 border border-slate-200">
            <span className="h-2 w-2 rounded-full bg-slate-400"></span>
            <span>UNKNOWN</span>
          </div>
        );
    }
  };

  const getModeBadge = (mode: string) => {
    switch (mode) {
      case 'REAL':
        return <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-200">REAL</span>;
      case 'SIMULATED':
        return <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-purple-100 text-purple-800 border border-purple-200">SIMULATED</span>;
      default:
        return <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-200 text-slate-700 border border-slate-300">UNAVAILABLE</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <HeaderBanner
        icon={Server}
        tag="Distributed Core Components"
        title="Services & Infrastructure Health"
        description="Real-time health and operational status of OrderFlow components."
        color="sky"
        actionButton={
          <button
            onClick={fetchServiceHealth}
            disabled={isLoading}
            className="flex items-center space-x-2 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh Health</span>
          </button>
        }
      />

      {/* Error Alert Banner if Backend Unreachable */}
      {errorMsg && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-amber-900 text-xs">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-amber-100 text-amber-700 rounded-xl">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <p className="font-bold text-sm">⚠️ Unable to load service health</p>
              <p className="text-amber-700 mt-0.5">{errorMsg} (Displaying inspectable simulated health snapshot).</p>
            </div>
          </div>
          <button
            onClick={fetchServiceHealth}
            className="px-3.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex-shrink-0 shadow-xs"
          >
            Retry Connection
          </button>
        </div>
      )}

      {/* Architecture Dependency Flow Diagram */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
          <Workflow className="h-4 w-4 text-blue-600" />
          Service Interaction & Architecture Relationship Topology
        </h3>

        <div className="overflow-x-auto p-4 bg-slate-50 rounded-xl border border-slate-200">
          <div className="flex flex-wrap items-center justify-center gap-3 font-mono text-xs text-slate-800">
            <div className="p-3 bg-white border border-blue-300 rounded-xl font-bold text-blue-800 shadow-xs flex items-center gap-2">
              <Cpu className="h-4 w-4 text-blue-600" />
              <span>Order Service</span>
            </div>

            <ArrowRight className="h-4 w-4 text-slate-400" />

            <div className="p-3 bg-white border border-slate-300 rounded-xl font-bold text-slate-800 shadow-xs flex items-center gap-2">
              <Database className="h-4 w-4 text-emerald-600" />
              <span>PostgreSQL DB</span>
            </div>

            <ArrowRight className="h-4 w-4 text-slate-400" />

            <div className="p-3 bg-white border border-slate-300 rounded-xl font-bold text-slate-800 shadow-xs flex items-center gap-2">
              <Layers className="h-4 w-4 text-indigo-600" />
              <span>Outbox Table</span>
            </div>

            <ArrowRight className="h-4 w-4 text-slate-400" />

            <div className="p-3 bg-white border border-purple-300 rounded-xl font-bold text-purple-800 shadow-xs flex items-center gap-2">
              <Radio className="h-4 w-4 text-purple-600" />
              <span>Kafka Event Mesh</span>
            </div>

            <ArrowRight className="h-4 w-4 text-slate-400" />

            <div className="flex flex-col gap-2">
              <div className="p-2 bg-white border border-slate-300 rounded-lg text-[11px] font-bold text-slate-800">
                Inventory Service
              </div>
              <div className="p-2 bg-white border border-slate-300 rounded-lg text-[11px] font-bold text-slate-800">
                Payment Service
              </div>
            </div>

            <ArrowRight className="h-4 w-4 text-slate-400" />

            <div className="p-3 bg-white border border-amber-300 rounded-xl font-bold text-amber-800 shadow-xs flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-600" />
              <span>RabbitMQ Broker</span>
            </div>

            <ArrowRight className="h-4 w-4 text-slate-400" />

            <div className="p-3 bg-white border border-slate-300 rounded-xl font-bold text-slate-800 shadow-xs">
              Notification Worker
            </div>
          </div>
        </div>
      </div>

      {/* Services Grid (Desktop 3-4 cols, Tablet 2 cols, Mobile 1 col) */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs animate-pulse space-y-4">
              <div className="h-4 bg-slate-200 rounded w-3/4"></div>
              <div className="h-6 bg-slate-200 rounded w-1/2"></div>
              <div className="space-y-2 pt-2">
                <div className="h-3 bg-slate-100 rounded w-full"></div>
                <div className="h-3 bg-slate-100 rounded w-5/6"></div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {services.map((svc) => (
            <div
              key={svc.id}
              onClick={() => setSelectedService(svc)}
              className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:border-blue-400 hover:shadow-md transition cursor-pointer flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <h4 className="font-extrabold text-slate-900 text-sm truncate">{svc.name}</h4>
                  {getModeBadge(svc.mode)}
                </div>

                <div className="mb-4">
                  {getStatusBadge(svc.status)}
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs font-mono py-2 border-t border-b border-slate-100">
                  <div>
                    <span className="text-slate-400 text-[10px] block">LATENCY</span>
                    <span className="font-bold text-slate-800">{svc.latencyMs} ms</span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] block">REQUESTS</span>
                    <span className="font-bold text-slate-800">{svc.requestsCount.toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] block">UPTIME</span>
                    <span className="font-bold text-emerald-700">{svc.uptime}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] block">LAST CHECK</span>
                    <span className="text-slate-600 text-[11px] truncate">{svc.lastChecked}</span>
                  </div>
                </div>
              </div>

              <div className="pt-3 flex items-center justify-between text-[11px] text-blue-600 font-bold">
                <span>Inspect Service Details</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Service Detail Modal / Drawer */}
      {selectedService && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white w-full max-w-lg rounded-2xl p-6 relative border border-slate-200 shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 rounded-xl bg-blue-50 text-blue-600 border border-blue-200">
                  <Server className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">{selectedService.name}</h3>
                  <p className="text-xs text-slate-500 font-mono">ID: {selectedService.id}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedService(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
              <div>
                <span className="text-xs text-slate-500 font-semibold block">Operational Status</span>
                <div className="mt-1">{getStatusBadge(selectedService.status)}</div>
              </div>
              <div>
                <span className="text-xs text-slate-500 font-semibold block">Data Source Mode</span>
                <div className="mt-1">{getModeBadge(selectedService.mode)}</div>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Service Properties & Diagnostics</h4>
              <div className="bg-slate-900 text-slate-100 rounded-xl p-4 font-mono text-xs space-y-2 overflow-x-auto">
                <div className="flex justify-between border-b border-slate-800 pb-1">
                  <span className="text-slate-400">Latency:</span>
                  <span className="text-cyan-400 font-bold">{selectedService.latencyMs} ms</span>
                </div>
                <div className="flex justify-between border-b border-slate-800 pb-1">
                  <span className="text-slate-400">Total Requests/Events:</span>
                  <span className="text-white font-bold">{selectedService.requestsCount}</span>
                </div>
                <div className="flex justify-between border-b border-slate-800 pb-1">
                  <span className="text-slate-400">SLA Uptime:</span>
                  <span className="text-emerald-400 font-bold">{selectedService.uptime}</span>
                </div>
                <div className="flex justify-between border-b border-slate-800 pb-1">
                  <span className="text-slate-400">Last Checked:</span>
                  <span className="text-slate-300">{selectedService.lastChecked}</span>
                </div>

                {Object.entries(selectedService.details).map(([key, val]) => (
                  <div key={key} className="flex justify-between border-b border-slate-800/60 pb-1">
                    <span className="text-slate-400 capitalize">{key.replace(/([A-Z])/g, ' $1')}:</span>
                    <span className="text-amber-300 font-semibold truncate max-w-[220px]">
                      {typeof val === 'object' ? JSON.stringify(val) : String(val)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setSelectedService(null)}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ServicesPage;
