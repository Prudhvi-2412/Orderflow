import React, { useState, useEffect } from 'react';
import { Activity } from 'lucide-react';
import { globalMetrics } from '../core/MetricsEngine.js';
import { globalLockManager } from '../core/LockManager.js';
import { globalEventBus, OutboxEvent } from '../core/EventBus.js';
import { HeaderBanner } from './Common/HeaderBanner.js';
import { MetricsGrid } from './Telemetry/MetricsGrid.js';
import { ActiveLocksTable } from './Telemetry/ActiveLocksTable.js';
import { ServiceLatenciesCard } from './Telemetry/ServiceLatenciesCard.js';
import { OutboxEventStream } from './Telemetry/OutboxEventStream.js';

export function SystemTelemetry() {
  const [metrics, setMetrics] = useState(globalMetrics.getMetrics());
  const [activeLocks, setActiveLocks] = useState(globalLockManager.getActiveLocks());
  const [eventLogs, setEventLogs] = useState<OutboxEvent[]>(globalEventBus.getLogs(50));
  const [selectedTopicFilter, setSelectedTopicFilter] = useState('ALL');

  useEffect(() => {
    const interval = setInterval(() => {
      setMetrics(globalMetrics.getMetrics());
      setActiveLocks(globalLockManager.getActiveLocks());
      setEventLogs(globalEventBus.getLogs(50));
    }, 300);

    return () => clearInterval(interval);
  }, []);

  const filteredLogs =
    selectedTopicFilter === 'ALL' ? eventLogs : eventLogs.filter((log) => log.topic === selectedTopicFilter);

  const topics = [
    'ALL',
    'OrderCreated',
    'InventoryReserved',
    'PaymentProcessed',
    'ShippingScheduled',
    'OrderCompleted',
    'OrderFailed',
    'PaymentRefunded'
  ];

  return (
    <div className="space-y-6">
      <HeaderBanner
        icon={Activity}
        tag="System Observability & Real-Time Telemetry"
        title="Throughput (RPS), Latency Distribution & Active Locks HUD"
        description="Monitor real-time system throughput, P50/P95/P99 latency percentiles across microservices, active Distributed Mutex Lease Locks, and inspect the continuous stream of Outbox Events."
        color="cyan"
      />

      <MetricsGrid
        metrics={metrics}
        activeLocksCount={activeLocks.length}
        contentionCount={globalLockManager.contentionCount}
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <ActiveLocksTable activeLocks={activeLocks} />
        <ServiceLatenciesCard services={metrics.services} />
      </div>

      <OutboxEventStream
        filteredLogs={filteredLogs}
        topics={topics}
        selectedTopicFilter={selectedTopicFilter}
        onSelectTopicFilter={setSelectedTopicFilter}
      />
    </div>
  );
}

export default SystemTelemetry;
