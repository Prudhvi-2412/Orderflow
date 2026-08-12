import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar.js';
import { SagaVisualizer } from './components/SagaVisualizer.js';
import { ConcurrencyTester } from './components/ConcurrencyTester.js';
import { IdempotencyTester } from './components/IdempotencyTester.js';
import { ResiliencePanel } from './components/ResiliencePanel.js';
import { SystemTelemetry } from './components/SystemTelemetry.js';
import { ArchitectureDoc } from './components/ArchitectureDoc.js';
import { CreateOrderModal } from './components/Modals/CreateOrderModal.js';
import { globalNotificationService, NotificationItem } from './services/NotificationService.js';
import { globalChaosEngine } from './simulator/ChaosEngine.js';

export function App() {
  const [activeTab, setActiveTab] = useState('saga');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  useEffect(() => {
    const interval = setInterval(() => {
      setNotifications([...globalNotificationService.getNotifications().slice(0, 3)]);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const handleQuickFlashSale = async () => {
    setActiveTab('concurrency');
    await globalChaosEngine.runFlashSaleSimulation({
      sku: 'ITEM-IPHONE-15',
      stockQty: 5,
      concurrentUsers: 25,
      lockStrategy: 'PESSIMISTIC'
    });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-slate-950">
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onQuickOrder={() => setIsModalOpen(true)}
        onQuickFlashSale={handleQuickFlashSale}
      />

      {notifications.length > 0 && (
        <div className="bg-slate-900/90 border-b border-slate-800/80 px-4 py-1.5 overflow-hidden">
          <div className="max-w-7xl mx-auto flex items-center justify-between text-xs">
            <div className="flex items-center space-x-2">
              <span className="h-2 w-2 rounded-full bg-cyan-400 animate-ping"></span>
              <span className="font-mono text-cyan-400 font-bold uppercase text-[10px]">Live System Stream:</span>
              <span className="text-slate-300 font-mono truncate max-w-xl">{notifications[0]?.message}</span>
            </div>
            <span className="text-[10px] text-slate-500 font-mono hidden sm:inline">{notifications[0]?.isoTime}</span>
          </div>
        </div>
      )}

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {activeTab === 'saga' && <SagaVisualizer onCreateOrder={() => setIsModalOpen(true)} />}
        {activeTab === 'concurrency' && <ConcurrencyTester />}
        {activeTab === 'idempotency' && <IdempotencyTester />}
        {activeTab === 'resilience' && <ResiliencePanel />}
        {activeTab === 'telemetry' && <SystemTelemetry />}
        {activeTab === 'architecture' && <ArchitectureDoc />}
      </main>

      <footer className="border-t border-slate-900 bg-slate-950 py-6 text-center text-xs text-slate-500 font-mono">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>OrderFlow Engine © 2026 — Distributed Systems Platform</span>
          <span className="text-cyan-400/80">Event-Driven • Saga Transactions • Redlock Mutex • Circuit Breaker</span>
        </div>
      </footer>

      <CreateOrderModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => setActiveTab('saga')}
      />
    </div>
  );
}

export default App;
