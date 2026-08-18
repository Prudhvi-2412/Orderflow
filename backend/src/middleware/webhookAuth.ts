import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';

/**
 * Production-style Webhook HMAC SHA-256 & Timestamp Verification Middleware
 * Contract:
 * - Signature Header: 'x-webhook-signature'
 * - Timestamp Header: 'x-webhook-timestamp' (Unix timestamp in ms or sec)
 * - Signed Payload: `${timestamp}.${rawBody}`
 * - Signature: HMAC-SHA256(secret, signedPayload)
 */
export function verifyWebhookSignature(req: Request, res: Response, next: NextFunction) {
  const signatureHeader = req.headers['x-webhook-signature'] as string;
  const timestampHeader = req.headers['x-webhook-timestamp'] as string;

  if (!signatureHeader) {
    return res.status(400).json({ error: 'Missing webhook signature header' });
  }

  if (!timestampHeader) {
    return res.status(400).json({ error: 'Missing webhook timestamp header' });
  }

  const timestampNum = Number(timestampHeader);
  if (isNaN(timestampNum) || !Number.isFinite(timestampNum) || timestampNum <= 0) {
    return res.status(400).json({ error: 'Malformed webhook timestamp header' });
  }

  const secret = process.env.WEBHOOK_SECRET || 'whsec_test_secret_1234567890';

  // Ensure verification uses RAW request body buffer/string, not a re-serialized object
  const rawBody = (req as any).rawBody 
    ? (req as any).rawBody.toString('utf-8') 
    : (typeof req.body === 'string' ? req.body : JSON.stringify(req.body));

  const signedPayload = `${timestampHeader}.${rawBody}`;

  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(signedPayload)
    .digest('hex');

  const providedBuffer = Buffer.from(signatureHeader, 'utf-8');
  const expectedBuffer = Buffer.from(expectedSignature, 'utf-8');

  // 1. Timing-safe signature length & content comparison to prevent timing side-channel attacks
  if (providedBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(providedBuffer, expectedBuffer)) {
    return res.status(401).json({ error: 'Invalid webhook signature' });
  }

  // 2. Timestamp Tolerance Window Check
  const toleranceSeconds = parseInt(process.env.WEBHOOK_TOLERANCE_SECONDS || '300', 10);
  const nowMs = Date.now();
  const timestampMs = timestampNum < 1e11 ? timestampNum * 1000 : timestampNum;
  const diffSeconds = Math.abs(nowMs - timestampMs) / 1000;

  if (diffSeconds > toleranceSeconds) {
    return res.status(401).json({ error: `Webhook timestamp outside tolerance window (${toleranceSeconds}s)` });
  }

  next();
}
