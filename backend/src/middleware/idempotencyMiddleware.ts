import { Request, Response, NextFunction } from 'express';
import { idempotencyService } from '../services/idempotencyService.js';

export async function idempotencyMiddleware(req: Request, res: Response, next: NextFunction) {
  const keyHeader = req.headers['idempotency-key'];

  if (keyHeader !== undefined) {
    if (typeof keyHeader !== 'string' || keyHeader.trim().length === 0 || keyHeader.trim().length > 255) {
      return res.status(400).json({ error: 'idempotencyKey must be a non-empty string with length <= 255' });
    }
  }

  const key = typeof keyHeader === 'string' ? keyHeader.trim() : undefined;

  if (!key) {
    return next(); // Proceed normally if no Idempotency-Key provided
  }

  try {
    const result = await idempotencyService.begin(key, req.body);

    if (result.action === 'PAYLOAD_MISMATCH') {
      return res.status(422).json({
        error: result.error,
        code: 'PAYLOAD_MISMATCH'
      });
    }

    if (result.action === 'IN_PROGRESS') {
      return res.status(409).json({
        error: result.error,
        code: 'IN_PROGRESS'
      });
    }

    if (result.action === 'SERVE_CACHE') {
      return res.status(result.statusCode || 201).json(result.response);
    }

    // Capture res.send to cache response body on completion
    const originalSend = res.send.bind(res);
    res.send = (body?: any): Response => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        try {
          const parsed = typeof body === 'string' ? JSON.parse(body) : body;
          idempotencyService.complete(key, req.body, parsed).catch(console.error);
        } catch (e) {
          idempotencyService.complete(key, req.body, body).catch(console.error);
        }
      } else {
        idempotencyService.fail(key).catch(console.error);
      }
      return originalSend(body);
    };

    next();
  } catch (err: any) {
    return res.status(500).json({ error: `Idempotency Middleware Failure: ${err.message}` });
  }
}
