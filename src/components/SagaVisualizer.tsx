import React, { useState, useEffect } from 'react';
import { Layers, Plus } from 'lucide-react';
import { globalOrderService, SagaState } from '../services/OrderService.js';
import { HeaderBanner } from './Common/HeaderBanner.js';
import { SagaTopologyMap } from './Saga/SagaTopologyMap.js';
import { SagaOrdersLedger } from './Saga/SagaOrdersLedger.js';
import { SagaDetailExplorer } from './Saga/SagaDetailExplorer.js';

export interface SagaVisualizerProps {
  onCreateOrder: () => void;
}

export function SagaVisualizer({ onCreateOrder }: SagaVisualizerProps) {
  const [orders, setOrders] = useState<SagaState[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<SagaState | null>(null);
  const [activeStepNode, setActiveStepNode] = useState<string | undefined>(undefined);

  useEffect(() => {
    setOrders(globalOrderService.getAllOrders());

    const unsubscribe = globalOrderService.onOrderChange((updatedOrder: SagaState) => {
      setOrders(globalOrderService.getAllOrders());
      setSelectedOrder((prev) => (prev?.orderId === updatedOrder.orderId ? updatedOrder : prev));
      if (updatedOrder.currentStep) {
        setActiveStepNode(updatedOrder.currentStep);
        setTimeout(() => setActiveStepNode(undefined), 1500);
      }
    });

    return () => unsubscribe();
  }, []);

  return (
    <div className="space-y-6">
      <HeaderBanner
        icon={Layers}
        title="Distributed Saga Pattern Orchestrator"
        description="Manages distributed transactions across isolated microservices with strict Event Outbox guarantees and automated Compensating Rollback Transactions upon downstream failure."
        color="cyan"
        actionButton={
          <button
            onClick={onCreateOrder}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 text-white font-medium text-sm shadow-lg shadow-cyan-500/25 hover:from-cyan-400 hover:to-indigo-500 transition-all flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            <span>Create Custom Order</span>
          </button>
        }
      />

      <SagaTopologyMap activeStepNode={activeStepNode} />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <SagaOrdersLedger orders={orders} selectedOrder={selectedOrder} onSelectOrder={setSelectedOrder} />
        <SagaDetailExplorer selectedOrder={selectedOrder} />
      </div>
    </div>
  );
}

export default SagaVisualizer;
