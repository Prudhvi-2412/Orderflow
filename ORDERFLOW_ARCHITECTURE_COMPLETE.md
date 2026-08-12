# ⚡ OrderFlow — Distributed Systems Architecture & Project Technical Blueprint

**OrderFlow** is a production-grade, event-driven distributed order processing platform engineered for high concurrency, microservices transaction atomicity, fault tolerance, data integrity, and real-time system observability.

---

## 📑 Table of Contents
1. [System Overview & Architecture](#-1-system-overview--architecture)
2. [Core Distributed Architecture Patterns](#-2-core-distributed-architecture-patterns)
   - [Orchestrated Saga Pattern](#-orchestrated-saga-pattern)
   - [Transactional Outbox Pattern](#-transactional-outbox-pattern)
   - [Concurrency Control & Mutex Locking](#-concurrency-control--mutex-locking)
   - [Idempotency & Deduplication Protocol](#-idempotency--deduplication-protocol)
   - [Fault Tolerance & Resilience Mesh](#-fault-tolerance--resilience-mesh)
3. [Telemetry & Observability Layer](#-3-telemetry--observability-layer)
4. [Microservices Map & Ports](#-4-microservices-map--ports)
5. [Full TypeScript Codebase Structure](#-5-full-typescript-codebase-structure)
6. [Tech Stack Summary](#-6-tech-stack-summary)
7. [Running Benchmarks & Stress Tests](#-7-running-benchmarks--stress-tests)

---

## 🏛️ 1. System Overview & Architecture

OrderFlow demonstrates how to process high-volume e-commerce transactions across isolated microservices while maintaining strict ACID guarantees, data consistency, and low latency under high load spikes (e.g. Flash Sales).

```
                                  +-----------------------+
                                  |    Client Frontend    |
                                  |  (React 18 + TSX HUD) |
                                  +-----------+-----------+
                                              |
                                              v (HTTP REST / WS)
                                  +-----------+-----------+
                                  |    API Gateway / REST |
                                  |      (Port 4000)      |
                                  +-----------+-----------+
                                              |
     +-----------------------+----------------+-----------------------+-----------------------+
     |                       |                                         |                       |
     v                       v                                         v                       v
+----+------------------+  +-+--------------------+                  +-+--------------------+  +-+--------------------+
|  Order Service        |  |  Inventory Service   |                  |  Payment Gateway     |  |  Shipping Service    |
|  (Saga Orchestrator)  |  |  (Redlock Mutex)     |                  |  (Circuit Breaker)   |  |  (Fulfillment)       |
|  Port: 4001           |  |  Port: 4002          |                  |  Port: 4003          |  |  Port: 4004          |
+----+------------------+  +-+--------------------+                  +-+--------------------+  +-+--------------------+
     |                       |                                         |                       |
     +-----------------------+----------------+-----------------------+-----------------------+
                                              |
                                              v
                              +---------------+---------------+
                              |   Event Mesh & Telemetry      |
                              | RabbitMQ / Kafka / OpenTelemetry|
                              +-------------------------------+
```

---

## 🔄 2. Core Distributed Architecture Patterns

### 🔄 Orchestrated Saga Pattern
- **Central Coordinator**: `OrderService` manages multi-step distributed transactions spanning isolated services (`Order` → `Inventory` → `Payment` → `Shipping`).
- **Compensating Transactions (Automated Rollback)**: If a downstream service fails (e.g., Payment declined or Gateway timeout), the orchestrator automatically triggers reverse compensating actions (e.g., releasing reserved inventory stock and updating order status to `CANCELLED`).

### 📦 Transactional Outbox Pattern
- **Dual-Write Prevention**: Microservices write business state and outgoing events atomically to an `Outbox Table` within the same local database transaction before broadcasting.
- **At-Least-Once Delivery**: Outbox worker threads continuously poll and publish events to RabbitMQ / Kafka, guaranteeing event delivery even under network partitions.

### 🔒 Concurrency Control & Mutex Locking
- **Pessimistic Redlock Mutex**: Acquires key lock `lock:inventory:{sku}` with TTL lease limits and **monotonically increasing fencing tokens** to eliminate overselling and stale worker writes during flash sales.
- **Optimistic CAS (Compare-And-Swap)**: Executes stock updates using atomic version checks:
  ```sql
  UPDATE inventory 
  SET stock = stock - :qty, version = version + 1 
  WHERE sku = :sku AND version = :version;
  ```
- **No-Lock Baseline**: Simulates raw race conditions for live side-by-side benchmark performance comparisons.

### 🛡️ Idempotency & Deduplication Protocol
- **Header Key Validation**: Inspects incoming `Idempotency-Key` headers on POST endpoints.
- **State Machine Protection**:
  - `PENDING`: Simultaneous duplicate calls receive `409 Conflict`.
  - `COMPLETED`: Subsequent retries immediately receive the cached result without re-executing business logic.
  - `Payload Hashing`: Mismatched payloads under an active key trigger `422 Unprocessable Content`.

### 🦺 Fault Tolerance & Resilience Mesh
- **Circuit Breakers**: Wraps external payment gateway calls with state transitions:
  ```
  CLOSED (Normal Operations)
      │
      ├─► (3 Consecutive Failures) ──► OPEN (Fast-Failing Requests)
      │                                     │
      │                                     ├─► (5s Reset Timeout)
      │                                     v
  CLOSED ◄── (2 Successes) ◄────────── HALF_OPEN (Testing Probe)
  ```
- **Dead Letter Queue (DLQ)**: Automatically routes unrecoverable messages to a DLQ after max retry attempts (3 retries) with live UI re-drive capabilities.
- **Downstream Chaos Injector**: Allows live fault injection (0-100% failure rate, 0-3000ms network latency, complete 503 outage toggle).

---

## 📊 3. Telemetry & Observability Layer

- **OpenTelemetry & Distributed Tracing**: Instrumenting HTTP requests and event streams with W3C `traceparent` context propagation (`traceId`, `spanId`).
- **Prometheus & Grafana Metrics Engine**: Scrape endpoint (`/api/metrics`) exposing system metrics:
  - Throughput (Requests Per Second - RPS)
  - Latency distribution percentiles ($P_{50}$, $P_{95}$, $P_{99}$)
  - Error rates & active Mutex lock lease tracking
- **Live Event Stream**: Real-time WebSocket feed pushing outbox events directly to the HUD.

---

## 🔌 4. Microservices Map & Ports

| Service Name | Port | Primary Responsibilities | Strategy / Resilience |
| :--- | :--- | :--- | :--- |
| **API Gateway** | `4000` | Routing, Rate Limiting, CORS | Token Bucket Rate Limiter |
| **Order Service** | `4001` | Saga Orchestration & State Tracking | Transactional Outbox Pattern |
| **Inventory Service** | `4002` | Stock Reservation & Inventory Management | Redlock Mutex & Version CAS |
| **Payment Service** | `4003` | Settlement & Refund Processing | Circuit Breaker & Chaos Injector |
| **Shipping Service** | `4004` | Fulfillment Scheduling & Tracking | Retrying Event Handlers |

---

## 📂 5. Full TypeScript Codebase Structure

```
OrderFlow/
├── backend/                  # Node.js/Express Microservices (100% TypeScript)
│   ├── src/
│   │   ├── api/              # Gateway & REST endpoints (.ts)
│   │   ├── db/               # PostgreSQL migrations & seeders (.ts)
│   │   ├── kafka/            # Kafka producers & topics (.ts)
│   │   ├── rabbitmq/         # RabbitMQ publishers & workers (.ts)
│   │   ├── redis/            # Redis Redlock client (.ts)
│   │   ├── resilience/       # Circuit breaker & retry engines (.ts)
│   │   └── telemetry/        # Prometheus & OpenTelemetry instrumentation (.ts)
│
├── src/                      # Glassmorphic React Frontend (100% TSX/TS)
│   ├── api/                  # Typed REST API & WebSocket clients (.ts)
│   ├── components/           # UI Components (.tsx)
│   │   ├── Architecture/     # System design accordion docs (.tsx)
│   │   ├── Common/           # Header banners & status badges (.tsx)
│   │   ├── Concurrency/      # Flash sale benchmark cards & forms (.tsx)
│   │   ├── Idempotency/      # Deduplication lab & state ledgers (.tsx)
│   │   ├── Modals/           # Custom order creation modal (.tsx)
│   │   ├── Resilience/       # Circuit breaker HUD, Chaos & DLQ manager (.tsx)
│   │   ├── Saga/             # Event mesh topology & order step timelines (.tsx)
│   │   └── Telemetry/        # Observability gauges & active lock tables (.tsx)
│   ├── core/                 # Frontend state engines & managers (.ts)
│   ├── services/             # Microservice business logic (.ts)
│   ├── simulator/            # Concurrency stress tester & Chaos engine (.ts)
│   ├── App.tsx               # Main application component (.tsx)
│   └── main.tsx              # React DOM entry point (.tsx)
│
└── k6/                       # Load Testing Suite
    └── flash_sale_load_test.ts # Type-safe k6 100-VU flash sale spike test (.ts/.tsx)
```

---

## 🛠️ 6. Tech Stack Summary

| Layer | Technologies & Tools |
| :--- | :--- |
| **Frontend UI** | React 18, TypeScript, Vanilla CSS + Tailwind CSS, Lucide React Icons |
| **Backend API** | Node.js, Express, TypeScript, REST APIs, WebSockets (`ws`) |
| **Databases & Caching** | PostgreSQL (`pg`), Redis (`ioredis` for Redlock Mutex) |
| **Messaging & Queues** | RabbitMQ (`amqplib`), Apache Kafka (`kafkajs`) |
| **Observability** | OpenTelemetry (`@opentelemetry/api`), Prometheus (`prom-client`) |
| **Stress Testing** | k6 Load Testing Engine |

---

## ⚡ 7. Running Benchmarks & Stress Tests

### Running the Frontend Dashboard
```bash
npm run dev
```

### Running Backend Services & Workers
```bash
# Start Express Server
npm run server

# Start Outbox Event Worker
npm run worker:outbox

# Start RabbitMQ Worker
npm run worker:notification
```

### Running k6 High-Concurrency Stress Test
```bash
npm run test:load
```

---

*OrderFlow Distributed Systems Engine © 2026 — Built with Event-Driven Architecture, Saga Transactions, Redlock Mutex, and Circuit Breakers.*
