export const KAFKA_TOPICS = {
  ORDERS_CREATED: 'orders.created',
  INVENTORY_RESERVED: 'inventory.reserved',
  INVENTORY_RELEASED: 'inventory.released',
  PAYMENT_INITIATED: 'payment.initiated',
  PAYMENT_COMPLETED: 'payment.completed',
  PAYMENT_FAILED: 'payment.failed',
  ORDERS_CONFIRMED: 'orders.confirmed',
  ORDERS_CANCELLED: 'orders.cancelled'
} as const;

export type KafkaTopic = typeof KAFKA_TOPICS[keyof typeof KAFKA_TOPICS];
