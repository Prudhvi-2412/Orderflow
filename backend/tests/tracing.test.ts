import { tracePropagator } from '../src/tracing/context.js';
import { traceSpan } from '../src/tracing/telemetry.js';

describe('OpenTelemetry & W3C Distributed Tracing Tests', () => {

  it('should generate valid W3C traceparent headers adhering to specification', () => {
    const ctx = tracePropagator.generateContext();
    expect(ctx.traceId).toHaveLength(32);
    expect(ctx.spanId).toHaveLength(16);
    expect(ctx.traceparent).toMatch(/^00-[a-f0-9]{32}-[a-f0-9]{16}-01$/);
  });

  it('should propagate traceId from parent to child context across service boundaries', () => {
    const parentCtx = tracePropagator.generateContext();
    const childCtx = tracePropagator.createChildContext(parentCtx.traceparent);

    // Child must preserve exact same traceId while generating unique child spanId!
    expect(childCtx.traceId).toBe(parentCtx.traceId);
    expect(childCtx.spanId).not.toBe(parentCtx.spanId);
    expect(childCtx.traceparent).toContain(parentCtx.traceId);
  });

  it('should record active telemetry spans via traceSpan abstraction', async () => {
    const result = await traceSpan('test_span', async (span) => {
      span.setAttribute('order.id', 'ORD-TRACE-100');
      return 'SPAN_OK';
    });

    expect(result).toBe('SPAN_OK');
  });

});
