import React, { useState } from 'react';
import { GitBranch, Clock, Layers, Database, Activity, CreditCard, Mail } from 'lucide-react';

export interface TraceSpan {
  id: string;
  service: string;
  operation: string;
  durationMs: number;
  offsetPct: number;
  widthPct: number;
  status: 'OK' | 'ERROR';
  icon: any;
  color: string;
}

export function WaterfallTraceViewer() {
  const [selectedSpan, setSelectedSpan] = useState<TraceSpan | null>(null);

  const spans: TraceSpan[] = [
    { id: 'span-1', service: 'API Gateway', operation: 'POST /api/orders', durationMs: 142, offsetPct: 0, widthPct: 100, status: 'OK', icon: Layers, color: 'bg-blue-500' },
    { id: 'span-2', service: 'Order Service', operation: 'Saga.StartTransaction', durationMs: 18, offsetPct: 3, widthPct: 13, status: 'OK', icon: Layers, color: 'bg-blue-600' },
    { id: 'span-3', service: 'PostgreSQL DB', operation: 'INSERT INTO outbox_events', durationMs: 8, offsetPct: 10, widthPct: 6, status: 'OK', icon: Database, color: 'bg-indigo-600' },
    { id: 'span-4', service: 'Kafka Mesh', operation: 'ProduceTopic(orders.created)', durationMs: 4, offsetPct: 17, widthPct: 3, status: 'OK', icon: Activity, color: 'bg-cyan-600' },
    { id: 'span-5', service: 'Inventory Service', operation: 'Redlock.AcquireMutex', durationMs: 21, offsetPct: 21, widthPct: 15, status: 'OK', icon: Database, color: 'bg-purple-600' },
    { id: 'span-6', service: 'Payment Gateway', operation: 'CircuitBreaker.ExecuteCharge', durationMs: 67, offsetPct: 38, widthPct: 47, status: 'OK', icon: CreditCard, color: 'bg-emerald-600' },
    { id: 'span-7', service: 'Notification Worker', operation: 'RabbitMQ.PublishEmail', durationMs: 9, offsetPct: 88, widthPct: 7, status: 'OK', icon: Mail, color: 'bg-amber-600' }
  ];

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center space-x-2">
            <GitBranch className="h-5 w-5 text-blue-600" />
            <h2 className="text-base font-bold text-slate-900 tracking-tight">OpenTelemetry Distributed Trace Waterfall</h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Trace ID: <code className="font-mono text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded font-bold">trace_9a82f3c_2026_otel</code> • Total Duration: 142 ms
          </p>
        </div>
        <span className="text-xs font-mono px-2.5 py-1 rounded bg-emerald-100 text-emerald-800 font-bold">
          ● 7 Spans Captured
        </span>
      </div>

      {/* Waterfall Spans Timeline */}
      <div className="space-y-3">
        {spans.map((span) => {
          const Icon = span.icon;
          const isSelected = selectedSpan?.id === span.id;

          return (
            <div
              key={span.id}
              onClick={() => setSelectedSpan(span)}
              className={`p-3 rounded-xl border transition cursor-pointer ${
                isSelected ? 'bg-blue-50 border-blue-400 shadow-sm' : 'bg-slate-50/60 border-slate-200 hover:bg-white'
              }`}
            >
              <div className="flex items-center justify-between text-xs mb-1.5">
                <div className="flex items-center space-x-2 font-semibold text-slate-900">
                  <Icon className="h-4 w-4 text-blue-600" />
                  <span>{span.service}</span>
                  <span className="text-slate-400 font-mono text-[11px]">[{span.operation}]</span>
                </div>
                <span className="font-mono font-bold text-slate-700">{span.durationMs} ms</span>
              </div>

              {/* Bar track */}
              <div className="w-full h-3 bg-slate-200 rounded-full relative overflow-hidden">
                <div
                  className={`h-full rounded-full ${span.color} transition-all duration-300`}
                  style={{
                    marginLeft: `${span.offsetPct}%`,
                    width: `${Math.max(span.widthPct, 2)}%`
                  }}
                ></div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Selected Span Detail Box */}
      {selectedSpan && (
        <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-200 text-xs space-y-2">
          <div className="flex items-center justify-between font-bold text-blue-900">
            <span>Span Details: {selectedSpan.service}</span>
            <span className="font-mono text-blue-700">{selectedSpan.durationMs} ms</span>
          </div>
          <p className="text-slate-600 font-mono">Operation: {selectedSpan.operation}</p>
          <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-slate-500 pt-2 border-t border-blue-200/60">
            <span>W3C Traceparent: 00-4bf92f3577b34da6a3ce929d0e0e4736-{selectedSpan.id}-01</span>
            <span>Span Kind: INTERNAL_CLIENT</span>
          </div>
        </div>
      )}
    </div>
  );
}
