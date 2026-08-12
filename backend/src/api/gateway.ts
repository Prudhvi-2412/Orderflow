import { Router } from 'express';
import { orderService } from '../services/orderService.js';
import { inventoryService } from '../services/inventoryService.js';
import { register, ordersTotalCounter } from '../metrics/prometheus.js';

export const apiRouter = Router();

/**
 * GET /api/health
 */
apiRouter.get('/health', (req, res) => {
  res.json({ status: 'UP', service: 'OrderFlow Distributed API Gateway', timestamp: new Date().toISOString() });
});

/**
 * GET /metrics - Prometheus Metrics Scraping Endpoint
 */
apiRouter.get('/metrics', async (req, res) => {
  try {
    res.setHeader('Content-Type', register.contentType);
    const metrics = await register.metrics();
    res.send(metrics);
  } catch (err: any) {
    res.status(500).send(err.message);
  }
});

/**
 * POST /api/orders - Submit Order via Saga Orchestrator
 */
apiRouter.post('/orders', async (req, res) => {
  try {
    const { sku, quantity, price, customerEmail, idempotencyKey, lockStrategy } = req.body;

    if (!sku || !quantity || !customerEmail) {
      return res.status(400).json({ error: 'Missing required parameters: sku, quantity, customerEmail' });
    }

    const result = await orderService.createOrder({
      sku,
      quantity: parseInt(quantity),
      price: parseFloat(price || 999),
      customerEmail,
      idempotencyKey: idempotencyKey || `idemp_${Date.now()}`,
      lockStrategy: lockStrategy || 'PESSIMISTIC'
    });

    // Record Prometheus Order Counter
    ordersTotalCounter.inc({ status: result.status, lock_strategy: lockStrategy || 'PESSIMISTIC' });

    return res.status(result.status === 'COMPLETED' ? 201 : 200).json(result);

  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/inventory/:sku - Query inventory stock
 */
apiRouter.get('/inventory/:sku', async (req, res) => {
  try {
    const stock = await inventoryService.getStock(req.params.sku);
    if (!stock) {
      return res.status(404).json({ error: 'SKU not found' });
    }
    return res.json(stock);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});
