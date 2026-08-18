-- PostgreSQL Production Schemas for OrderFlow Engine

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Products Table
CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    sku VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Inventory Table (Source of truth for stock & optimistic CAS versioning)
CREATE TABLE IF NOT EXISTS inventory (
    id SERIAL PRIMARY KEY,
    sku VARCHAR(100) UNIQUE NOT NULL REFERENCES products(sku) ON DELETE CASCADE,
    stock_quantity INT NOT NULL CHECK (stock_quantity >= 0),
    version INT NOT NULL DEFAULT 1,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for stock lookups
CREATE INDEX IF NOT EXISTS idx_inventory_sku ON inventory(sku);

-- 4. Orders Table (Saga State Tracker)
CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    order_id VARCHAR(100) UNIQUE NOT NULL,
    customer_email VARCHAR(255) NOT NULL,
    total_amount DECIMAL(10, 2) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'PROCESSING', -- PENDING, PROCESSING, COMPLETED, CANCELLED, FAILED
    lock_strategy VARCHAR(50) NOT NULL DEFAULT 'PESSIMISTIC', -- NONE, OPTIMISTIC, PESSIMISTIC
    error_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_orders_order_id ON orders(order_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);

-- 5. Order Items Table
CREATE TABLE IF NOT EXISTS order_items (
    id SERIAL PRIMARY KEY,
    order_id VARCHAR(100) NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,
    sku VARCHAR(100) NOT NULL REFERENCES products(sku),
    quantity INT NOT NULL CHECK (quantity > 0),
    price DECIMAL(10, 2) NOT NULL
);

-- 6. Payments Table
CREATE TABLE IF NOT EXISTS payments (
    id SERIAL PRIMARY KEY,
    order_id VARCHAR(100) NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,
    txn_id VARCHAR(100) UNIQUE NOT NULL,
    idempotency_key VARCHAR(255) UNIQUE,
    amount DECIMAL(10, 2) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'SUCCESS', -- PENDING, PROCESSING, SUCCESS, REFUNDED, FAILED
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_payment_order UNIQUE (order_id)
);

-- Ensure columns/constraints exist if table was created in an earlier migration
ALTER TABLE payments ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(255) UNIQUE;

-- 6b. Inventory Reservations Table (Idempotent Stock Reservation & Release)
CREATE TABLE IF NOT EXISTS inventory_reservations (
    id SERIAL PRIMARY KEY,
    order_id VARCHAR(100) NOT NULL,
    sku VARCHAR(100) NOT NULL REFERENCES products(sku),
    quantity INT NOT NULL CHECK (quantity > 0),
    status VARCHAR(50) NOT NULL DEFAULT 'RESERVED', -- RESERVED, RELEASED, CONFIRMED
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_reservation_order UNIQUE (order_id)
);

CREATE INDEX IF NOT EXISTS idx_inventory_reservations_order ON inventory_reservations(order_id);

-- 7. Transactional Outbox Table
CREATE TABLE IF NOT EXISTS outbox_events (
    id SERIAL PRIMARY KEY,
    event_id VARCHAR(100) UNIQUE NOT NULL,
    topic VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING', -- PENDING, PROCESSING, PUBLISHED, FAILED
    attempts INT NOT NULL DEFAULT 0,
    error TEXT,
    processing_started_at TIMESTAMP WITH TIME ZONE,
    claim_token VARCHAR(64),
    next_retry_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE outbox_events ADD COLUMN IF NOT EXISTS claim_token VARCHAR(64);

ALTER TABLE outbox_events ADD COLUMN IF NOT EXISTS processing_started_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE outbox_events ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_outbox_status ON outbox_events(status);

-- 8. Processed Events Table (Idempotent Kafka Consumer Tracker)
CREATE TABLE IF NOT EXISTS processed_events (
    id SERIAL PRIMARY KEY,
    event_id VARCHAR(100) NOT NULL,
    consumer_group VARCHAR(100) NOT NULL,
    processed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_event_consumer UNIQUE (event_id, consumer_group)
);

-- 9. Idempotency Keys Table
CREATE TABLE IF NOT EXISTS idempotency_keys (
    id SERIAL PRIMARY KEY,
    key VARCHAR(255) UNIQUE NOT NULL,
    request_hash VARCHAR(64) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING', -- PENDING, COMPLETED, FAILED
    response_body JSONB,
    processing_started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE idempotency_keys ADD COLUMN IF NOT EXISTS processing_started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_idempotency_key ON idempotency_keys(key);
