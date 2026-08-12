# OrderFlow ⚡ Production Distributed Order Processing & System Design Platform

[![Node.js](https://img.shields.io/badge/Node.js-v20-brightgreen?style=for-the-badge&logo=node.js)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-v5-blue?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-v15-blue?style=for-the-badge&logo=postgresql)](https://www.postgresql.org)
[![Apache Kafka](https://img.shields.io/badge/Apache_Kafka-v7.5-red?style=for-the-badge&logo=apachekafka)](https://kafka.apache.org)
[![RabbitMQ](https://img.shields.io/badge/RabbitMQ-v3.12-orange?style=for-the-badge&logo=rabbitmq)](https://www.rabbitmq.com)
[![Redis](https://img.shields.io/badge/Redis-v7-red?style=for-the-badge&logo=redis)](https://redis.io)
[![OpenTelemetry](https://img.shields.io/badge/OpenTelemetry-Tracing-purple?style=for-the-badge&logo=opentelemetry)](https://opentelemetry.io)
[![Prometheus](https://img.shields.io/badge/Prometheus-Metrics-orange?style=for-the-badge&logo=prometheus)](https://prometheus.io)
[![Docker](https://img.shields.io/badge/Docker_Compose-12_Containers-blue?style=for-the-badge&logo=docker)](https://www.docker.com)

---

## 📌 Executive Summary

**OrderFlow** is a portfolio-grade, distributed order processing and resilience platform built with **TypeScript, Node.js, PostgreSQL, Apache Kafka, RabbitMQ, Redis, OpenTelemetry, and Prometheus**.

It demonstrates how modern distributed systems handle high-concurrency flash sales, race conditions, event delivery guarantees, microservices orchestration, and infrastructure outages while maintaining **ACID transactional integrity, zero overselling, and sub-200ms latency**.

---

## 🏛️ System Architecture

```
+---------------------------------------------------------------------------------------+
|                                  DOCKER COMPOSE NETWORK                               |
|                                                                                       |
|  +--------------------+    +---------------------+    +----------------------------+  |
|  | orderflow-ui (5173)| -> | orderflow-api (4000)| -> | PostgreSQL Database (5432)  |  |
|  +--------------------+    +---------------------+    +----------------------------+  |
|                                       |                                               |
|                    +------------------+------------------+                            |
|                    |                  |                  |                            |
|                    v                  v                  v                            |
|             +--------------+   +--------------+   +--------------+                    |
|             | Redis (6379) |   | Kafka (9092) |   |RabbitMQ(5672)|                    |
|             +--------------+   +--------------+   +--------------+                    |
|                                       |                  |                            |
|                                       v                  v                            |
|                                +--------------+   +--------------+                    |
|                                | Outbox Worker|   | Notif Worker |                    |
|                                +--------------+   +--------------+                    |
|                                                                                       |
|  +---------------------+   +---------------------+   +-----------------------------+  |
|  | Prometheus (9090)   |   | Grafana UI (3000)   |   | Jaeger Tracing (16686/4318) |  |
|  +---------------------+   +---------------------+   +-----------------------------+  |
+---------------------------------------------------------------------------------------+
```

---

## 🚀 Distributed Systems Features Implemented

### 1. 🔒 Concurrency Control & Zero Overselling
- **Pessimistic Row-Level Locking (`SELECT FOR UPDATE`)**: Locks rows in PostgreSQL during stock reservation to prevent race conditions.
- **k6 Load Test Benchmark**: 100 Virtual Users hammering 1 stock item yields **exactly 1 success, 99 rejections, and 0 oversold items**.

### 2. 🔄 Orchestrated Saga Pattern & Compensating Rollbacks
- **State Machine**: Persistent order lifecycle in PostgreSQL (`PROCESSING` → `INVENTORY_RESERVATION` → `PAYMENT_PROCESSING` → `COMPLETED` / `CANCELLED`).
- **Compensating Transactions**: Automatic stock release (`releaseStock`) and refund processing if downstream payment or logistics fail.

### 3. 📦 Transactional Outbox Pattern
- **At-Least-Once Event Delivery**: Staged event publishing inside PostgreSQL transactions to eliminate phantom events and dual-write anomalies.
- **Worker Polling**: Polling background worker using `FOR UPDATE SKIP LOCKED`.

### 4. 🛡️ Idempotent Consumers (`processed_events`)
- **Deduplication Guard**: Tracks `(event_id, consumer_group)` in PostgreSQL to deduplicate redelivered Kafka messages.

### 5. ⚡ RabbitMQ Dead Letter Queue (DLQ)
- **DLX Mechanics**: Failed notification jobs are routed to DLX after maximum retries for manual or automated re-driving.

### 6. 🚀 Dual-Layer Idempotency & Redis Rate Limiting
- **Dual-Layer Validation**: Fast Redis hash lookup + durable PostgreSQL audit ledger.
- **Token Bucket Rate Limiter**: Redis-backed rate limiting with fail-open safety.

### 7. 🛡️ Production 3-State Circuit Breaker & Chaos Engineering
- **State Machine**: `CLOSED` → `OPEN` → `HALF_OPEN` state transitions. Fast-fails downstream calls in 0ms during outages.
- **Chaos Injector**: Configurable latency delays, randomized failures, and 503 outage injection.

### 8. 📊 Observability (OpenTelemetry, Prometheus & Grafana)
- **W3C Distributed Tracing**: Propagates `traceparent` headers across HTTP, Kafka, and RabbitMQ to Jaeger.
- **Prometheus Metrics**: Exposes `/api/metrics` with RED framework counters and histograms.

---

## ⚡ Quick Start with Docker Compose

Launch the entire 12-container distributed infrastructure with one command:

```bash
# 1. Clone repository
git clone https://github.com/user/orderflow.git
cd orderflow

# 2. Spin up 12-container environment
docker compose up --build
```

### Access Infrastructure Interfaces:
- **React Telemetry UI**: `http://localhost:5173`
- **Express API Gateway**: `http://localhost:4000/api/health`
- **Prometheus Metrics**: `http://localhost:4000/api/metrics`
- **Jaeger Distributed Tracing**: `http://localhost:16686`
- **Prometheus UI**: `http://localhost:9090`
- **Grafana UI**: `http://localhost:3000` (admin/admin)
- **RabbitMQ Management**: `http://localhost:15672` (guest/guest)

---

## 🧪 Testing & Load Benchmarks

```bash
# Database Migrations & Seeding
npm run db:migrate
npm run db:seed

# Unit & Integration Test Suites
npm test

# k6 Concurrency Benchmark (100 VUs on 1 Stock Unit)
npm run test:load
```

---

## 📜 License

MIT License © 2026 OrderFlow Engine
