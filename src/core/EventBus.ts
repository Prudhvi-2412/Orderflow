export interface OutboxEvent {
  id: string;
  topic: string;
  payload: any;
  sagaId?: string | null;
  timestamp: number;
  isoTime: string;
  status: 'OUTBOX_COMMITTED' | 'DISPATCHING' | 'DELIVERED_NO_HANDLERS' | 'COMPLETED' | 'DEAD_LETTERED';
  attempts: number;
  error?: string | null;
}

export interface DLQItem extends OutboxEvent {
  deadLetteredAt: number;
  reason: string;
}

export type EventHandler = (payload: any, event: OutboxEvent) => Promise<void> | void;
export type TelemetryListener = (detail: any) => void;

export class EventBus {
  private subscribers = new Map<string, EventHandler[]>();
  public eventLog: OutboxEvent[] = [];
  public outboxQueue: OutboxEvent[] = [];
  public deadLetterQueue: DLQItem[] = [];
  private listeners: TelemetryListener[] = [];
  public maxRetries = 3;
  private isProcessingOutbox = false;

  subscribe(topic: string, handler: EventHandler): () => void {
    if (!this.subscribers.has(topic)) {
      this.subscribers.set(topic, []);
    }
    this.subscribers.get(topic)!.push(handler);

    return () => {
      const handlers = this.subscribers.get(topic) || [];
      this.subscribers.set(topic, handlers.filter((h) => h !== handler));
    };
  }

  onEvent(listener: TelemetryListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  async publish(topic: string, payload: any, meta: { eventId?: string; sagaId?: string } = {}): Promise<void> {
    const event: OutboxEvent = {
      id: meta.eventId || `evt_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      topic,
      payload,
      sagaId: meta.sagaId || payload?.orderId || null,
      timestamp: Date.now(),
      isoTime: new Date().toISOString(),
      status: 'OUTBOX_COMMITTED',
      attempts: 0,
      error: null
    };

    this.outboxQueue.push(event);
    this.eventLog.unshift(event);
    this._notifyListeners({ type: 'OUTBOX_ADDED', event });

    return await this._processOutbox();
  }

  private async _processOutbox(): Promise<void> {
    if (this.isProcessingOutbox) return;
    this.isProcessingOutbox = true;

    while (this.outboxQueue.length > 0) {
      const event = this.outboxQueue.shift()!;
      event.status = 'DISPATCHING';
      this._notifyListeners({ type: 'EVENT_DISPATCHING', event });

      const handlers = this.subscribers.get(event.topic) || [];

      if (handlers.length === 0) {
        event.status = 'DELIVERED_NO_HANDLERS';
        this._notifyListeners({ type: 'EVENT_DELIVERED', event });
        continue;
      }

      let success = true;
      for (const handler of handlers) {
        let handlerAttempts = 0;
        let handlerSuccess = false;

        while (handlerAttempts < this.maxRetries && !handlerSuccess) {
          handlerAttempts++;
          event.attempts++;
          try {
            await handler(event.payload, event);
            handlerSuccess = true;
          } catch (err: any) {
            event.error = err.message;
            if (handlerAttempts < this.maxRetries) {
              await new Promise((r) => setTimeout(r, handlerAttempts * 100));
            }
          }
        }

        if (!handlerSuccess) {
          success = false;
          break;
        }
      }

      if (success) {
        event.status = 'COMPLETED';
        this._notifyListeners({ type: 'EVENT_COMPLETED', event });
      } else {
        event.status = 'DEAD_LETTERED';
        this.deadLetterQueue.unshift({
          ...event,
          deadLetteredAt: Date.now(),
          reason: `Failed after ${event.attempts} attempts: ${event.error}`
        });
        this._notifyListeners({ type: 'EVENT_DLQ', event });
      }
    }

    this.isProcessingOutbox = false;
  }

  async redriveDLQItem(eventId: string): Promise<void> {
    const index = this.deadLetterQueue.findIndex((item) => item.id === eventId);
    if (index === -1) return;

    const [dlqItem] = this.deadLetterQueue.splice(index, 1);

    return await this.publish(dlqItem.topic, dlqItem.payload, {
      sagaId: dlqItem.sagaId || undefined,
      eventId: `redrive_${dlqItem.id}`
    });
  }

  purgeDLQ(): void {
    this.deadLetterQueue = [];
    this._notifyListeners({ type: 'DLQ_PURGED' });
  }

  private _notifyListeners(detail: any): void {
    this.listeners.forEach((l) => {
      try {
        l(detail);
      } catch (e) {
        console.error('Error in EventBus listener', e);
      }
    });
  }

  getLogs(limit = 100): OutboxEvent[] {
    return this.eventLog.slice(0, limit);
  }

  getDLQ(): DLQItem[] {
    return this.deadLetterQueue;
  }

  clearLogs(): void {
    this.eventLog = [];
    this.deadLetterQueue = [];
  }
}

export const globalEventBus = new EventBus();
