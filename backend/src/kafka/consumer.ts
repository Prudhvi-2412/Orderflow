import { Consumer } from 'kafkajs';
import { kafka } from './client.js';
import { KAFKA_TOPICS, KafkaTopic } from './topics.js';
import { wrapIdempotentConsumer } from './idempotentConsumer.js';

export type EventMessageHandler = (topic: string, payload: any, meta: any) => Promise<void>;

export class OrderFlowKafkaConsumer {
  private consumer: Consumer;
  private isConnected = false;
  private handlers = new Map<string, EventMessageHandler[]>();
  private groupId: string;

  constructor(groupId = 'order-processing-group') {
    this.groupId = groupId;
    this.consumer = kafka.consumer({
      groupId,
      sessionTimeout: 30000,
      heartbeatInterval: 3000
    });
  }

  registerHandler(topic: KafkaTopic, handler: EventMessageHandler): void {
    if (!this.handlers.has(topic)) {
      this.handlers.set(topic, []);
    }
    
    // Automatically wrap handler with Idempotent Consumer Guard
    const idempotentHandler = wrapIdempotentConsumer({
      consumerGroup: this.groupId,
      handler
    });

    this.handlers.get(topic)!.push(idempotentHandler);
  }

  async start(): Promise<void> {
    try {
      await this.consumer.connect();
      this.isConnected = true;
      console.log(`✅ Apache Kafka Consumer Group '${this.groupId}' connected.`);

      const topics = Object.values(KAFKA_TOPICS);
      for (const topic of topics) {
        await this.consumer.subscribe({ topic, fromBeginning: false });
      }

      await this.consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
          const rawValue = message.value?.toString();
          if (!rawValue) return;

          try {
            const data = JSON.parse(rawValue);
            const topicHandlers = this.handlers.get(topic) || [];

            for (const handler of topicHandlers) {
              await handler(topic, data.payload, {
                partition,
                offset: message.offset,
                key: message.key?.toString(),
                eventId: data.eventId || `evt_${topic}_${partition}_${message.offset}`
              });
            }
          } catch (err: any) {
            console.error(`❌ Kafka Consumer Error [Group: ${this.groupId}, Topic: ${topic}, Partition: ${partition}, Offset: ${message.offset}]:`, err.message);
          }
        }
      });
    } catch (err: any) {
      console.warn(`[Kafka Consumer Warning] Could not start Kafka consumer group '${this.groupId}' (${err.message}).`);
    }
  }

  async disconnect(): Promise<void> {
    if (this.isConnected) {
      await this.consumer.disconnect();
      this.isConnected = false;
    }
  }
}

export const kafkaConsumer = new OrderFlowKafkaConsumer();
