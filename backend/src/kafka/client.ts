import { Kafka, logLevel, SASLOptions } from 'kafkajs';
import dotenv from 'dotenv';

dotenv.config();

const brokerStr = process.env.KAFKA_BROKER || process.env.KAFKA_BROKERS || 'localhost:9092';
const brokers = brokerStr.split(',').map((b) => b.trim());

const ssl = process.env.KAFKA_SSL === 'true' || process.env.KAFKA_SSL === '1' || brokerStr.includes('aivencloud.com');

const username = process.env.KAFKA_USERNAME;
const password = process.env.KAFKA_PASSWORD;

let sasl: SASLOptions | undefined;
if (username && password) {
  sasl = {
    mechanism: 'scram-sha-256',
    username,
    password
  };
}

export const kafka = new Kafka({
  clientId: process.env.KAFKA_CLIENT_ID || 'orderflow-engine',
  brokers,
  ssl: ssl ? { rejectUnauthorized: false } : undefined,
  sasl,
  logLevel: logLevel.WARN,
  retry: {
    initialRetryTime: 300,
    retries: 5
  }
});
