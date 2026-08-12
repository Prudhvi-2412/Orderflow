import React from 'react';
import { Layers, Package, CreditCard, Truck, CheckCircle2, Clock, ArrowRight } from 'lucide-react';

export interface SagaTopologyMapProps {
  activeStepNode?: string;
  stepStatuses?: Record<string, 'COMPLETED' | 'RUNNING' | 'FAILED' | 'PENDING'>;
}

export function SagaTopologyMap({ activeStepNode, stepStatuses = {} }: SagaTopologyMapProps) {
  const steps = [
    {
      id: 'ORDER_CREATED',
      name: 'Order Created',
      service: 'Order Service (Port 4001)',
      latency: '14ms',
      icon: Layers,
      defaultStatus: 'COMPLETED'
    },
    {
      id: 'INVENTORY_RESERVATION',
      name: 'Inventory Reserved',
      service: 'Inventory Service (Port 4002)',
      latency: '18ms',
      icon: Package,
      defaultStatus: 'COMPLETED'
    },
    {
      id: 'PAYMENT_PROCESSING',
      name: 'Payment Processing',
      service: 'Payment Gateway (Port 4003)',
      latency: '42ms',
      icon: CreditCard,
      defaultStatus: 'RUNNING'
    },
    {
      id: 'SHIPPING',
      name: 'Fulfillment Dispatch',
      service: 'Shipping Service (Port 4004)',
      latency: 'PENDING',
      icon: Truck,
      defaultStatus: 'PENDING'
    }
  ];

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-base font-bold text-slate-900 tracking-tight">Interactive Saga Workflow Mesh</h3>
          <p className="text-xs text-slate-500 mt-0.5">Real-time distributed transaction particle flow & state transitions</p>
        </div>
        <div className="flex items-center space-x-2 text-xs font-mono text-blue-600 bg-blue-50 px-3 py-1 rounded-lg border border-blue-200">
          <span className="h-2 w-2 rounded-full bg-blue-600 animate-ping"></span>
          <span>Live Particle Bus</span>
        </div>
      </div>

      {/* Workflow Horizontal Node Flow */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 relative items-center">
        {steps.map((step, idx) => {
          const Icon = step.icon;
          const status = stepStatuses[step.id] || (activeStepNode === step.id ? 'RUNNING' : step.defaultStatus);

          const isCompleted = status === 'COMPLETED';
          const isRunning = status === 'RUNNING';
          const isFailed = status === 'FAILED';

          return (
            <React.Fragment key={step.id}>
              <div
                className={`p-4 rounded-xl border transition-all duration-300 relative ${
                  isCompleted
                    ? 'bg-emerald-50/50 border-emerald-300 shadow-sm'
                    : isRunning
                    ? 'bg-blue-50/80 border-blue-400 shadow-md shadow-blue-500/10 ring-2 ring-blue-500/20 animate-pulse'
                    : isFailed
                    ? 'bg-rose-50/80 border-rose-300 shadow-sm'
                    : 'bg-slate-50 border-slate-200 opacity-75'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div
                    className={`p-2.5 rounded-lg border ${
                      isCompleted
                        ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                        : isRunning
                        ? 'bg-blue-600 text-white border-blue-500'
                        : isFailed
                        ? 'bg-rose-100 text-rose-700 border-rose-200'
                        : 'bg-slate-200 text-slate-600 border-slate-300'
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>

                  <span
                    className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${
                      isCompleted
                        ? 'bg-emerald-100 text-emerald-800'
                        : isRunning
                        ? 'bg-blue-100 text-blue-800 animate-pulse'
                        : isFailed
                        ? 'bg-rose-100 text-rose-800'
                        : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {status}
                  </span>
                </div>

                <h4 className="font-bold text-slate-900 text-sm tracking-tight">{step.name}</h4>
                <p className="text-[11px] text-slate-500 mt-1">{step.service}</p>

                <div className="mt-3 pt-2.5 border-t border-slate-200 flex items-center justify-between text-[11px] font-mono">
                  <span className="text-slate-400">Latency:</span>
                  <span className={`font-bold ${isCompleted ? 'text-emerald-700' : 'text-slate-700'}`}>
                    {step.latency}
                  </span>
                </div>
              </div>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
