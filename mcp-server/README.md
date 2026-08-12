# OrderFlow MCP (Model Context Protocol) AI Operations Server ⚡

Official Model Context Protocol (MCP) Server for the **OrderFlow Distributed Engine**.

Sitting ABOVE the core distributed architecture, this server provides an AI Operations control plane allowing AI assistants (Claude, Antigravity, Custom Agents) to inspect and safely operate OrderFlow without bypassing business rules or directly modifying database tables.

---

## 🏛️ MCP Architecture

```
                 AI Assistant / LLM / Agent
                              |
                              | MCP Standard Transport
                              v
                   +----------------------+
                   | OrderFlow MCP Server |
                   | (Node.js + TS SDK)   |
                   +----------+-----------+
                              |
            +-----------------+-----------------+
            |                 |                 |
            v                 v                 v
     OrderFlow APIs     Prometheus      Kafka / RabbitMQ
            |                 |                 |
            v                 v                 v
       PostgreSQL           Metrics         DLQ Events
            |
          Redis
```

---

## 🛠️ Registered MCP Tools

### READ-ONLY TOOLS:
1. `get_order(orderId)`: Retrieves order details, item breakdown, payment status, inventory status, and Saga ID.
2. `get_saga_status(orderId)`: Retrieves complete Saga execution timeline, current state, and compensation status.
3. `get_order_events(orderId)`: Fetches outbox events and processed consumer events for an order.
4. `get_inventory(sku)`: Queries real SKU stock levels, version CAS, and availability.
5. `get_service_health`: Queries real-time connection state of PostgreSQL, Redis, Kafka, RabbitMQ, and Gateway.
6. `get_system_metrics`: Retrieves RED framework metrics (RPS throughput, P50/P95/P99 latency, active locks).
7. `get_kafka_events`: Returns recent Kafka topic event log messages.
8. `get_dlq_messages`: Inspects Dead-Letter Queue (DLQ) notification tasks.

### SAFE WRITE TOOLS (REQUIRED RBAC & HUMAN CONFIRMATION):
1. `retry_order(orderId, confirmationConfirmed, userRole)`: Re-executes failed orders via Saga Orchestrator.
2. `redrive_dlq_message(messageId, confirmationConfirmed, userRole)`: Re-enqueues DLQ tasks back to main queue.
3. `replay_event(eventId, confirmationConfirmed, userRole)`: Re-publishes outbox events to Kafka.
4. `reset_circuit_breaker(serviceName, confirmationConfirmed, userRole)`: Resets circuit breaker state to CLOSED.

---

## 📚 Registered MCP Resources
- `orderflow://architecture`: System design architecture summary.
- `orderflow://services`: Microservice health registry.
- `orderflow://kafka/topics`: Active Kafka event topics.
- `orderflow://metrics`: Platform RED metrics.
- `orderflow://dlq`: Dead-letter queue telemetry.
- `orderflow://saga/{orderId}`: Live Saga execution status.

---

## 🚀 How to Run

```bash
# Development mode with live reload
npm run mcp:server

# Execute unit & integration test suite
npm test
```
