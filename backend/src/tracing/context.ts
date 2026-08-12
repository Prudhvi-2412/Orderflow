import crypto from 'crypto';

export interface TraceContext {
  traceId: string;
  spanId: string;
  traceparent: string;
}

export class W3CTracePropagator {
  
  /**
   * Generate new W3C Trace Context Header
   * Format: 00-{32_hex_trace_id}-{16_hex_span_id}-01
   */
  generateContext(): TraceContext {
    const traceId = crypto.randomBytes(16).toString('hex');
    const spanId = crypto.randomBytes(8).toString('hex');
    const traceparent = `00-${traceId}-${spanId}-01`;

    return {
      traceId,
      spanId,
      traceparent
    };
  }

  /**
   * Create Child Span Context from incoming traceparent
   */
  createChildContext(parentTraceparent?: string): TraceContext {
    if (!parentTraceparent || !parentTraceparent.startsWith('00-')) {
      return this.generateContext();
    }

    const parts = parentTraceparent.split('-');
    if (parts.length < 4) {
      return this.generateContext();
    }

    const traceId = parts[1];
    const newSpanId = crypto.randomBytes(8).toString('hex');

    return {
      traceId,
      spanId: newSpanId,
      traceparent: `00-${traceId}-${newSpanId}-01`
    };
  }
}

export const tracePropagator = new W3CTracePropagator();
