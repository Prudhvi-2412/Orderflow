import { rabbitMQClient, RABBITMQ_QUEUES } from './client.js';
import { NotificationTaskPayload } from './producer.js';

export async function startNotificationWorker() {
  const channel = await rabbitMQClient.connect();

  if (!channel) {
    console.warn('[Notification Worker] Standalone RabbitMQ connection not available.');
    return;
  }

  console.log('⚡ Notification Worker listening on queue:', RABBITMQ_QUEUES.NOTIFICATION);

  channel.consume(
    RABBITMQ_QUEUES.NOTIFICATION,
    async (msg) => {
      if (!msg) return;

      let task: NotificationTaskPayload;
      try {
        task = JSON.parse(msg.content.toString());
      } catch (e) {
        console.error('❌ Malformed RabbitMQ task message. Dead-lettering directly.');
        channel.nack(msg, false, false); // Reject without requeue -> Goes to DLQ
        return;
      }

      console.log(`[Notification Worker] Processing ${task.type} for Order ${task.orderId} (Recipient: ${task.recipient})...`);

      try {
        // Execute Notification Job (Email / SMS / Push)
        await executeNotification(task);

        // Acknowledge task completion
        channel.ack(msg);
        console.log(`✅ [Notification Worker] ${task.type} sent successfully for Order ${task.orderId}. Task ACKed.`);

      } catch (err: any) {
        console.error(`❌ [Notification Worker] Failed to send ${task.type} for Order ${task.orderId}: ${err.message}`);

        const currentAttempts = (task.attempts || 0) + 1;

        if (currentAttempts >= 3) {
          console.error(`🛑 Max retries (3/3) exceeded for task ${task.orderId}. Sending to Dead Letter Queue (DLQ).`);
          // Reject with requeue=false -> Triggers RabbitMQ DLX routing to notification_dlq
          channel.nack(msg, false, false);
        } else {
          console.warn(`🔄 Re-queueing task for Order ${task.orderId} (Attempt ${currentAttempts}/3)...`);
          // Re-queue with incremented attempt counter
          task.attempts = currentAttempts;
          channel.ack(msg); // Ack original message
          
          // Re-publish with attempt count
          const updatedPayload = Buffer.from(JSON.stringify(task));
          channel.sendToQueue(RABBITMQ_QUEUES.NOTIFICATION, updatedPayload, { persistent: true });
        }
      }
    },
    { noAck: false } // Enforce manual ACK/NACK
  );
}

async function executeNotification(task: NotificationTaskPayload): Promise<void> {
  // Simulate network delay
  await new Promise(r => setTimeout(r, 100));

  // Simulate artificial failure if requested in payload
  if (task.data?.forceFail) {
    throw new Error('Notification Service Gateway Timeout (504)');
  }
}

if (process.argv[1] && process.argv[1].includes('worker.ts')) {
  startNotificationWorker();
}
