import React from 'react';
import { Layers, Package, CreditCard, Truck, ArrowRight, LucideIcon } from 'lucide-react';
import { ServiceNodeCard } from './ServiceNodeCard.js';

export interface SagaTopologyMapProps {
  activeStepNode?: string;
}

export function SagaTopologyMap({ activeStepNode }: SagaTopologyMapProps) {
  const nodes: {
    id: string;
    name: string;
    description: string;
    badge: string;
    topic: string;
    port: string;
    icon: LucideIcon;
    themeColor: 'cyan' | 'purple' | 'emerald' | 'amber';
  }[] = [
    {
      id: 'ORDER_CREATED',
      name: 'Order Service',
      description: 'Idempotency check & Saga coordinator',
      badge: 'Orchestrator',
      topic: 'OrderCreated',
      port: '4001',
      icon: Layers,
      themeColor: 'cyan'
    },
    {
      id: 'INVENTORY_RESERVATION',
      name: 'Inventory Service',
      description: 'Stock reservation & Redlock Mutex',
      badge: 'Distributed Lock',
      topic: 'InventoryReserved',
      port: '4002',
      icon: Package,
      themeColor: 'purple'
    },
    {
      id: 'PAYMENT_PROCESSING',
      name: 'Payment Gateway',
      description: 'Settlement & Compensation refund',
      badge: 'Circuit Breaker',
      topic: 'PaymentProcessed',
      port: '4003',
      icon: CreditCard,
      themeColor: 'emerald'
    },
    {
      id: 'SHIPPING',
      name: 'Shipping Service',
      description: 'Label dispatch & tracking info',
      badge: 'Fulfillment',
      topic: 'ShippingScheduled',
      port: '4004',
      icon: Truck,
      themeColor: 'amber'
    }
  ];

  return (
    <div className="glass-panel rounded-2xl p-6">
      <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-6 flex items-center justify-between">
        <span>Live Microservices Event Mesh Topology</span>
        <span className="text-xs font-mono text-cyan-400 flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-cyan-400 animate-ping"></span>
          Real-Time State Bus
        </span>
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 relative">
        {nodes.map((node, index) => (
          <React.Fragment key={node.id}>
            <ServiceNodeCard
              name={node.name}
              description={node.description}
              badge={node.badge}
              topic={node.topic}
              port={node.port}
              icon={node.icon}
              isActive={activeStepNode === node.id}
              themeColor={node.themeColor}
            />
            {index < nodes.length - 1 && (
              <div className="hidden md:flex items-center justify-center -mx-2 z-10">
                <ArrowRight className="h-5 w-5 text-slate-600 animate-pulse" />
              </div>
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
