import React, { useState } from 'react';
import { BookOpen, Layers, Lock, Repeat, ShieldAlert } from 'lucide-react';
import { HeaderBanner } from './Common/HeaderBanner.js';
import { ArchitectureAccordionItem } from './Architecture/ArchitectureAccordionItem.js';

export function ArchitectureDoc() {
  const [openSection, setOpenSection] = useState<string | null>('saga');

  const toggleSection = (id: string) => {
    setOpenSection((prev) => (prev === id ? null : id));
  };

  return (
    <div className="space-y-6">
      <HeaderBanner
        icon={BookOpen}
        tag="Distributed Backend System Blueprint"
        title="System Design & Architecture Deep-Dive"
        description="Complete technical documentation, distributed patterns reference, and system design guide for OrderFlow engine architecture."
        color="sky"
      />

      <div className="space-y-4">
        <ArchitectureAccordionItem
          id="saga"
          icon={Layers}
          title="1. Orchestrated Saga Pattern & Transactional Outbox"
          subtitle="Distributed multi-service transaction atomicity without 2PC (Two-Phase Commit)"
          color="cyan"
          isOpen={openSection === 'saga'}
          onToggle={toggleSection}
        >
          <p>
            In a microservices architecture, traditional ACID database transactions spanning multiple databases are anti-patterns. <strong>OrderFlow implements the Orchestrated Saga Pattern</strong> where <code>OrderService</code> acts as the central Saga Orchestrator.
          </p>

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 font-mono text-[11px] text-blue-800 font-bold">
            OrderService → Reserve Stock → Process Payment → Schedule Shipping → Complete
            <br />
            ↳ [If Payment Fails] → Trigger Compensation: Release Reserved Stock → Mark Cancelled
          </div>

          <h4 className="font-bold text-slate-900 text-xs mt-3">Transactional Outbox Pattern</h4>
          <p className="text-slate-600">
            To avoid dual-write problems (writing to DB but failing to publish to RabbitMQ/Kafka), events are first written atomically to an <code>Outbox Queue</code> before dispatching. This guarantees <strong>at-least-once message delivery</strong>.
          </p>
        </ArchitectureAccordionItem>

        <ArchitectureAccordionItem
          id="locks"
          icon={Lock}
          title="2. Concurrency Control: Redlock Mutex vs Optimistic CAS"
          subtitle="Eliminating overselling during high-throughput flash sales"
          color="purple"
          isOpen={openSection === 'locks'}
          onToggle={toggleSection}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
              <h4 className="font-bold text-indigo-900 mb-1">Pessimistic Distributed Mutex (Redlock)</h4>
              <p className="text-[11px] text-slate-600 leading-normal">
                Acquires key lock <code>lock:inventory:{`{sku}`}</code> with TTL before evaluating stock. Employs <strong>monotonically increasing fencing tokens</strong> to prevent stale workers from writing past lease expiration.
              </p>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
              <h4 className="font-bold text-amber-900 mb-1">Optimistic Locking (Version CAS)</h4>
              <p className="text-[11px] text-slate-600 leading-normal">
                Executes updates with <code>WHERE sku = :sku AND version = :v</code>. Avoids lock holding overhead, ideal when contention is low or retry backoff is acceptable.
              </p>
            </div>
          </div>
        </ArchitectureAccordionItem>

        <ArchitectureAccordionItem
          id="idemp"
          icon={Repeat}
          title="3. Idempotency & Request Deduplication Protocol"
          subtitle="Guaranteeing exactly-once execution across network retries"
          color="emerald"
          isOpen={openSection === 'idemp'}
          onToggle={toggleSection}
        >
          <p className="text-slate-700">When a client sends an <code>Idempotency-Key</code> header:</p>
          <ul className="list-disc list-inside space-y-1 text-slate-600 pl-2">
            <li><strong>State PENDING:</strong> Rejects simultaneous duplicate calls with <code>409 Conflict</code>.</li>
            <li><strong>State COMPLETED:</strong> Serves cached response immediately with zero downstream database modifications.</li>
            <li><strong>Payload Hash Check:</strong> Validates payload string. Different payload under same key yields <code>422 Unprocessable Content</code>.</li>
          </ul>
        </ArchitectureAccordionItem>

        <ArchitectureAccordionItem
          id="cb"
          icon={ShieldAlert}
          title="4. Fault Tolerance: Circuit Breakers & Dead Letter Queues"
          subtitle="Isolating downstream failures and re-driving unrecoverable messages"
          color="rose"
          isOpen={openSection === 'cb'}
          onToggle={toggleSection}
        >
          <p className="text-slate-700">Circuit Breakers protect downstream resources from overload. State transitions:</p>
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 font-mono text-[11px] text-rose-800 font-bold">
            CLOSED (Normal) → [3 Consecutive Failures] → OPEN (Fast Fail) → [5s Reset Timeout] → HALF_OPEN (Probe Test) → [2 Successes] → CLOSED
          </div>
          <p className="text-slate-600">
            Failed events after 3 retries are placed in the <code>Dead Letter Queue (DLQ)</code> for operator inspection and automated/manual re-drive.
          </p>
        </ArchitectureAccordionItem>
      </div>
    </div>
  );
}

export default ArchitectureDoc;
