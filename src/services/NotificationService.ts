import { globalEventBus } from '../core/EventBus.js';

export interface SystemNotification {
  id: string;
  type: 'SUCCESS' | 'ERROR' | 'WARNING' | 'INFO';
  message: string;
  timestamp: number;
  isoTime: string;
}

export type NotificationItem = SystemNotification;

export class NotificationService {
  public notifications: SystemNotification[] = [];

  constructor() {
    this._initSubscriptions();
  }

  private _initSubscriptions(): void {
    globalEventBus.subscribe('OrderCompleted', (payload: any) => {
      this._addAlert('SUCCESS', `Order #${payload.orderId.slice(-6)} completed! Tracking #${payload.shippingInfo?.trackingNumber || 'N/A'}`);
    });

    globalEventBus.subscribe('OrderFailed', (payload: any) => {
      this._addAlert('ERROR', `Order #${payload.orderId.slice(-6)} failed: ${payload.reason}`);
    });

    globalEventBus.subscribe('PaymentRefunded', (payload: any) => {
      this._addAlert('WARNING', `Refund of $${payload.amountRefunded} processed for Order #${payload.orderId.slice(-6)}`);
    });
  }

  private _addAlert(type: 'SUCCESS' | 'ERROR' | 'WARNING' | 'INFO', message: string): void {
    this.notifications.unshift({
      id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      type,
      message,
      timestamp: Date.now(),
      isoTime: new Date().toLocaleTimeString()
    });
    if (this.notifications.length > 50) this.notifications.pop();
  }

  getNotifications(): SystemNotification[] {
    return this.notifications;
  }
}

export const globalNotificationService = new NotificationService();
