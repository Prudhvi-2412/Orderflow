import amqp, { Connection, Channel } from 'amqplib';
import dotenv from 'dotenv';

dotenv.config();

export const RABBITMQ_EXCHANGES = {
  ORDERS: 'orders_exchange',
  DLX: 'notification_dlx'
};

export const RABBITMQ_QUEUES = {
  NOTIFICATION: 'notification_queue',
  NOTIFICATION_DLQ: 'notification_dlq'
};

export const RABBITMQ_ROUTING_KEYS = {
  NOTIFICATION_SEND: 'notification.send',
  NOTIFICATION_DLQ: 'notification_dlq_key'
};

export class OrderFlowRabbitMQ {
  private connection: Connection | null = null;
  private channel: Channel | null = null;
  private isConnected = false;

  async connect(): Promise<Channel | null> {
    if (this.isConnected && this.channel) {
      return this.channel;
    }

    const url = process.env.RABBITMQ_URL || 'amqp://localhost:5672';

    try {
      this.connection = await amqp.connect(url);
      this.channel = await this.connection.createChannel();
      this.isConnected = true;

      // 1. Declare Main Exchange & Dead Letter Exchange (DLX)
      await this.channel.assertExchange(RABBITMQ_EXCHANGES.ORDERS, 'topic', { durable: true });
      await this.channel.assertExchange(RABBITMQ_EXCHANGES.DLX, 'direct', { durable: true });

      // 2. Declare Dead Letter Queue (DLQ)
      await this.channel.assertQueue(RABBITMQ_QUEUES.NOTIFICATION_DLQ, { durable: true });
      await this.channel.bindQueue(
        RABBITMQ_QUEUES.NOTIFICATION_DLQ,
        RABBITMQ_EXCHANGES.DLX,
        RABBITMQ_ROUTING_KEYS.NOTIFICATION_DLQ
      );

      // 3. Declare Main Notification Queue with x-dead-letter-exchange configured
      await this.channel.assertQueue(RABBITMQ_QUEUES.NOTIFICATION, {
        durable: true,
        arguments: {
          'x-dead-letter-exchange': RABBITMQ_EXCHANGES.DLX,
          'x-dead-letter-routing-key': RABBITMQ_ROUTING_KEYS.NOTIFICATION_DLQ
        }
      });

      await this.channel.bindQueue(
        RABBITMQ_QUEUES.NOTIFICATION,
        RABBITMQ_EXCHANGES.ORDERS,
        RABBITMQ_ROUTING_KEYS.NOTIFICATION_SEND
      );

      // Set prefetch for worker load balancing
      await this.channel.prefetch(1);

      console.log('✅ RabbitMQ Connection & Queue Topology Established (Exchanges, Queues, DLX).');
      return this.channel;

    } catch (err: any) {
      console.warn(`[RabbitMQ Warning] Unable to connect to RabbitMQ at ${url} (${err.message}). Defaulting to fallback mode.`);
      return null;
    }
  }

  async close(): Promise<void> {
    if (this.channel) await this.channel.close();
    if (this.connection) await this.connection.close();
    this.isConnected = false;
  }
}

export const rabbitMQClient = new OrderFlowRabbitMQ();
