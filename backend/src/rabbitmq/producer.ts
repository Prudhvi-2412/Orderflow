import { rabbitMQClient, RABBITMQ_EXCHANGES, RABBITMQ_ROUTING_KEYS } from './client.js';

export interface NotificationTaskPayload {
  orderId: string;
  type: 'EMAIL' | 'SMS' | 'PUSH';
  recipient: string;
  template: string;
  data: Record<string, any>;
  attempts?: number;
}

export class RabbitMQTaskProducer {
  
  async sendNotificationTask(task: NotificationTaskPayload): Promise<boolean> {
    const channel = await rabbitMQClient.connect();

    const payloadBuffer = Buffer.from(JSON.stringify({
      ...task,
      attempts: task.attempts || 0,
      timestamp: Date.now()
    }));

    if (channel) {
      try {
        const sent = channel.publish(
          RABBITMQ_EXCHANGES.ORDERS,
          RABBITMQ_ROUTING_KEYS.NOTIFICATION_SEND,
          payloadBuffer,
          {
            persistent: true, // Message durability on disk
            headers: {
              jobType: task.type,
              orderId: task.orderId
            }
          }
        );
        return sent;
      } catch (err: any) {
        console.error('❌ RabbitMQ Task Publish Error:', err.message);
        return false;
      }
    }
    return false;
  }
}

export const rabbitMQProducer = new RabbitMQTaskProducer();
