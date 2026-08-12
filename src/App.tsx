import React, { useState, useEffect } from 'react';
import { AuthProvider } from './context/AuthContext.js';
import { Header } from './components/Navigation/Header.js';
import { Sidebar } from './components/Navigation/Sidebar.js';
import { OverviewDashboard } from './components/Dashboard/OverviewDashboard.js';
import { SagaVisualizer } from './components/SagaVisualizer.js';
import { OrderManagementPage } from './components/Orders/OrderManagementPage.js';
import { ServicesPage } from './components/Services/ServicesPage.js';
import { KafkaEventStreamPage } from './components/Kafka/KafkaEventStreamPage.js';
import { WaterfallTraceViewer } from './components/Observability/WaterfallTraceViewer.js';
import { InventoryLabPage } from './components/Inventory/InventoryLabPage.js';
import { LoadTestingPage } from './components/LoadTesting/LoadTestingPage.js';
import { IdempotencyTester } from './components/IdempotencyTester.js';
import { ResiliencePanel } from './components/ResiliencePanel.js';
import { SystemTelemetry } from './components/SystemTelemetry.js';
import { ArchitectureDoc } from './components/ArchitectureDoc.js';
import { CreateOrderModal } from './components/Modals/CreateOrderModal.js';
import { AuthModal } from './components/Modals/AuthModal.js';

import { globalNotificationService, NotificationItem } from './services/NotificationService.js';
import { globalChaosEngine } from './simulator/ChaosEngine.js';

export function AppContent() {
  const [activeTab, setActiveTab] = useState('overview');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  useEffect(() => {
    const interval = setInterval(() => {
      setNotifications([...globalNotificationService.getNotifications().slice(0, 3)]);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const handleQuickFlashSale = async () => {
    setActiveTab('inventory');
    await globalChaosEngine.runFlashSaleSimulation({
      sku: 'ITEM-IPHONE-15',
      stockQty: 5,
      concurrentUsers: 25,
      lockStrategy: 'PESSIMISTIC'
    });
  };

  return (
    <div className="min-h-screen bg-[#F4F8FC] text-slate-900 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      {/* Enterprise Top Header */}
      <Header
        onNewOrder={() => setIsModalOpen(true)}
        onTriggerFlashSale={handleQuickFlashSale}
        onOpenAuth={() => setIsAuthModalOpen(true)}
      />

      {/* Real-time Ticker Banner */}
      {notifications.length > 0 && (
        <div className="bg-blue-50/80 border-b border-blue-100 px-6 py-1.5 backdrop-blur-xs flex items-center justify-between text-xs">
          <div className="flex items-center space-x-2.5">
            <span className="h-2 w-2 rounded-full bg-blue-600 animate-ping"></span>
            <span className="font-mono text-blue-800 font-extrabold uppercase tracking-wider text-[10px]">
              Live Stream:
            </span>
            <span className="text-slate-700 font-mono truncate max-w-2xl text-[11px]">
              {notifications[0]?.message}
            </span>
          </div>
          <span className="text-[10px] text-slate-500 font-mono hidden sm:inline">
            {notifications[0]?.isoTime}
          </span>
        </div>
      )}

      {/* Main Workspace Layout (Sidebar + Content) */}
      <div className="flex-1 flex overflow-hidden">
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          isCollapsed={isSidebarCollapsed}
          setIsCollapsed={setIsSidebarCollapsed}
        />

        <main className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6">
          <div className="max-w-7xl mx-auto space-y-6">
            {activeTab === 'overview' && <OverviewDashboard />}
            {activeTab === 'saga' && <SagaVisualizer onCreateOrder={() => setIsModalOpen(true)} />}
            {activeTab === 'orders' && <OrderManagementPage />}
            {activeTab === 'services' && <ServicesPage />}
            {activeTab === 'kafka' && <KafkaEventStreamPage />}
            {(activeTab === 'observability' || activeTab === 'trace') && <WaterfallTraceViewer />}
            {(activeTab === 'inventory' || activeTab === 'concurrency') && <InventoryLabPage />}
            {activeTab === 'loadtesting' && <LoadTestingPage />}
            {activeTab === 'idempotency' && <IdempotencyTester />}
            {activeTab === 'resilience' && <ResiliencePanel />}
            {activeTab === 'telemetry' && <SystemTelemetry />}
            {activeTab === 'architecture' && <ArchitectureDoc />}
          </div>
        </main>
      </div>

      {/* Modals */}
      <CreateOrderModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => setActiveTab('saga')}
      />

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
      />
    </div>
  );
}

export function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
