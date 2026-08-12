import React, { useState, useEffect } from 'react';
import { Activity, Search, Filter, RefreshCw, CheckCircle2, Play, Pause } from 'lucide-react';
import { wsClient } from '../../api/websocketClient.js';

export interface KafkaEventItem {
  id: string;
  timestamp: string;
  topic: string;
  partition: string;
  offset: number;
  event: string;
  consumer: string;
  status: 'SUCCESS' | 'PROCESSING' | 'FAILED';
  payload?: any;
}

export function KafkaEventStreamPage() {
  const [events, setEvents] = useState<KafkaEventItem[]>([
    { id: '1', timestamp: '12:42:31', topic: 'orders.created', partition: 'P2', offset: 18421, event: 'OrderCreated', consumer: 'inventory-service', status: 'SUCCESS' },
    { id: '2', timestamp: '12:42:32', topic: 'inventory.reserved', partition: 'P1', offset: 9410, event: 'InventoryReserved', consumer: 'payment-service', status: 'SUCCESS' },
    { id: '3', timestamp: '12:42:33', topic: 'payment.processed', partition: 'P0', offset: 5120, event: 'PaymentProcessed', consumer: 'shipping-service', status: 'SUCCESS' },
    { id: '4', timestamp: '12:42:34', topic: 'shipping.scheduled', partition: 'P3', offset: 3105, event: 'ShippingScheduled', consumer: 'notification-service', status: 'SUCCESS' }
  ]);

  const [search, setSearch] = useState('');
  const [selectedTopic, setSelectedTopic] = useState('ALL');
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    const unsubscribe = wsClient.subscribe((evt: any) => {
      if (isPaused) return;

      const newEvt: KafkaEventItem = {
        id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        timestamp: new Date().toLocaleTimeString(),
        topic: evt.topic || 'orders.events',
        partition: `P${Math.floor(Math.random() * 4)}`,
        offset: Math.floor(10000 + Math.random() * 90000),
        event: evt.eventType || evt.type || 'OrderEvent',
        consumer: evt.consumer || 'orderflow-consumer-group',
        status: 'SUCCESS',
        payload: evt
      };

      setEvents((prev) => [newEvt, ...prev.slice(0, 49)]);
    });

    return () => unsubscribe();
  }, [isPaused]);

  const filteredEvents = events.filter((e) => {
    const matchesSearch =
      e.event.toLowerCase().includes(search.toLowerCase()) ||
      e.topic.toLowerCase().includes(search.toLowerCase()) ||
      e.consumer.toLowerCase().includes(search.toLowerCase());
    const matchesTopic = selectedTopic === 'ALL' || e.topic === selectedTopic;
    return matchesSearch && matchesTopic;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Kafka Event Stream</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 border border-blue-200">
              ● Live Consumer Group
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Real-time topic messages, partition offsets, and transactional outbox stream logs.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => setIsPaused(!isPaused)}
            className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold border transition ${
              isPaused
                ? 'bg-amber-50 text-amber-700 border-amber-300'
                : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
            }`}
          >
            {isPaused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
            <span>{isPaused ? 'Resume Stream' : 'Pause Stream'}</span>
          </button>
        </div>
      </div>

      {/* Controls & Search */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-col md:flex-row items-center justify-between gap-3 shadow-xs">
        <div className="relative w-full md:w-96">
          <Search className="h-4 w-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Search topic, event, consumer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-300 text-xs text-slate-900 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
          />
        </div>

        <div className="flex items-center space-x-3 w-full md:w-auto">
          <div className="flex items-center space-x-2 text-xs text-slate-500 font-medium">
            <Filter className="h-4 w-4 text-slate-400" />
            <span>Topic:</span>
          </div>
          <select
            value={selectedTopic}
            onChange={(e) => setSelectedTopic(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-300 text-xs text-slate-800 font-medium bg-white focus:outline-none focus:border-blue-600"
          >
            <option value="ALL">All Topics</option>
            <option value="orders.created">orders.created</option>
            <option value="inventory.reserved">inventory.reserved</option>
            <option value="payment.processed">payment.processed</option>
            <option value="shipping.scheduled">shipping.scheduled</option>
          </select>
        </div>
      </div>

      {/* Events Stream Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-sans">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-mono text-[11px] uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Topic</th>
                <th className="py-3 px-4">Partition</th>
                <th className="py-3 px-4">Offset</th>
                <th className="py-3 px-4">Event Type</th>
                <th className="py-3 px-4">Consumer</th>
                <th className="py-3 px-4 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono text-xs">
              {filteredEvents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400 font-sans">
                    No matching events in stream.
                  </td>
                </tr>
              ) : (
                filteredEvents.map((evt) => (
                  <tr key={evt.id} className="hover:bg-blue-50/40 transition">
                    <td className="py-3 px-4 text-slate-500">{evt.timestamp}</td>
                    <td className="py-3 px-4 font-bold text-blue-700">{evt.topic}</td>
                    <td className="py-3 px-4 text-slate-600">{evt.partition}</td>
                    <td className="py-3 px-4 text-slate-900 font-bold">{evt.offset}</td>
                    <td className="py-3 px-4 font-bold text-slate-800 font-sans">{evt.event}</td>
                    <td className="py-3 px-4 text-slate-600">{evt.consumer}</td>
                    <td className="py-3 px-4 text-right">
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                        <CheckCircle2 className="h-3 w-3" />
                        {evt.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
