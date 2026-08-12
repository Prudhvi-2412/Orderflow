import { sagaOrchestrator } from '../src/saga/sagaOrchestrator.js';
import { paymentService } from '../src/services/paymentService.js';
import { inventoryService } from '../src/services/inventoryService.js';
import { pool } from '../src/config/db.js';

describe('Saga Orchestration & Compensating Transactions Tests', () => {

  it('should execute full Saga workflow to COMPLETED status on happy path', async () => {
    paymentService.setChaos(0, false); // No failure
    const orderId = `ORD-SAGA-SUCCESS-${Date.now()}`;
    const sku = 'ITEM-IPHONE-15';

    // Insert order record in DB
    await pool.query(
      `INSERT INTO orders (order_id, customer_email, total_amount, status)
       VALUES ($1, 'alex.dev@example.com', 999.00, 'PROCESSING')`,
      [orderId]
    );

    const result = await sagaOrchestrator.executeSaga(orderId, sku, 1, 999.00, 'alex.dev@example.com', 'PESSIMISTIC');

    expect(result.status).toBe('COMPLETED');
    expect(result.currentStep).toBe('CONFIRMED');
  });

  it('should execute Saga Compensating Rollback (Release Stock) when payment fails', async () => {
    paymentService.setChaos(100, true); // Force 100% payment outage
    const orderId = `ORD-SAGA-FAIL-${Date.now()}`;
    const sku = 'ITEM-IPHONE-15';

    const initialStockObj = await inventoryService.getStock(sku);
    const initialStock = initialStockObj?.stock_quantity || 5;

    // Insert order record in DB
    await pool.query(
      `INSERT INTO orders (order_id, customer_email, total_amount, status)
       VALUES ($1, 'alex.dev@example.com', 999.00, 'PROCESSING')`,
      [orderId]
    );

    const result = await sagaOrchestrator.executeSaga(orderId, sku, 1, 999.00, 'alex.dev@example.com', 'PESSIMISTIC');

    expect(result.status).toBe('CANCELLED');
    expect(result.errorReason).toContain('Payment Gateway Outage');

    // Verify inventory stock was restored back via compensating transaction!
    const finalStockObj = await inventoryService.getStock(sku);
    expect(finalStockObj.stock_quantity).toBe(initialStock);

    // Reset chaos
    paymentService.setChaos(0, false);
  });

});
