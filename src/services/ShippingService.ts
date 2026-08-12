import { globalMetrics } from '../core/MetricsEngine.js';
import { globalEventBus } from '../core/EventBus.js';

export interface ShipmentInfo {
  trackingNumber: string;
  orderId: string;
  items: any[];
  address: string;
  status: 'LABEL_CREATED' | 'CANCELLED';
  estimatedDelivery: string;
  createdAt: number;
}

export class ShippingService {
  private shipments = new Map<string, ShipmentInfo>();

  async scheduleShipment(
    orderId: string,
    items: any[],
    address = '123 Tech Park Ave, Silicon Valley CA'
  ): Promise<ShipmentInfo> {
    const startTime = Date.now();
    await new Promise((r) => setTimeout(r, 50 + Math.random() * 50));

    const trackingNumber = `TRACK-TRK-${Math.floor(100000 + Math.random() * 900000)}`;
    const shipment: ShipmentInfo = {
      trackingNumber,
      orderId,
      items,
      address,
      status: 'LABEL_CREATED',
      estimatedDelivery: new Date(Date.now() + 86400000 * 2).toLocaleDateString(),
      createdAt: Date.now()
    };

    this.shipments.set(orderId, shipment);
    globalMetrics.record('ShippingService', Date.now() - startTime, true);

    return shipment;
  }

  async cancelShipment(orderId: string): Promise<boolean> {
    const shipment = this.shipments.get(orderId);
    if (shipment) {
      shipment.status = 'CANCELLED';
      await globalEventBus.publish('ShipmentCancelled', { orderId, trackingNumber: shipment.trackingNumber });
    }
    return true;
  }
}

export const globalShippingService = new ShippingService();
