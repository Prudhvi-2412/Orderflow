import { Producer } from 'kafkajs';
import { kafka } from './client.js';
import { KafkaTopic } from './topics.js';

export class OrderFlowKafkaProducer {
  private producer: Producer;
  private isConnected = false;

  constructor() {
    this.producer = kafka.producer({
      allowAutoTopicCreation: true,
      transactionTimeout: 30000
    });
  }

  async connect(): Promise<void> {
    if (this.isConnected) return;
    try {
      await this.producer.connect();
      this.isConnected = true;
      console.log('✅ Apache Kafka Producer connected to brokers.');
    } catch (err: any) {
      console.warn(`[Kafka Producer Warning] Could not connect to Kafka brokers (${err.message}). Defaulting to standalone Outbox mode.`);
    }
  }

  async publish(topic: KafkaTopic, key: string, payload: any, meta: { sagaId?: string; eventId?: string } = {}): Promise<boolean> {
    const eventId = meta.eventId || `evt_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const eventMessage = {
      eventId,
      topic,
      payload,
      sagaId: meta.sagaId || key,
      timestamp: Date.now()
    };

    if (!this.isConnected) {
      await this.connect();
    }

    if (this.isConnected) {
      try {
        await this.producer.send({
          topic,
          messages: [
            {
              key, // Partition Key (Order ID) guarantees strictly ordered processing per order
              value: JSON.stringify(eventMessage),
              headers: {
                eventId,
                sagaId: meta.sagaId || key,
                publishedAt: new Date().toISOString()
              }
            }
          ]
        });
        return true;
      } catch (err: any) {
        console.error(`❌ Kafka Publish Error [Topic: ${topic}]:`, err.message);
        return false;
      }
    }
    return false;
  }

  async disconnect(): Promise<void> {
    if (this.isConnected) {
      await this.producer.disconnect();
      this.isConnected = false;
    }
  }
}

export const kafkaProducer = new OrderFlowKafkaProducer();
