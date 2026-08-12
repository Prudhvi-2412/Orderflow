import { trace, Tracer, Span } from '@opentelemetry/api';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';

const provider = new NodeTracerProvider({
  resource: new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: 'orderflow-distributed-engine',
    [SemanticResourceAttributes.SERVICE_VERSION]: '1.0.0'
  })
});

provider.register();

export const tracer: Tracer = trace.getTracer('orderflow-tracer', '1.0.0');

export async function traceSpan<T>(
  spanName: string,
  fn: (span: Span) => Promise<T>,
  attributes: Record<string, any> = {}
): Promise<T> {
  return await tracer.startActiveSpan(spanName, async (span) => {
    try {
      for (const [key, value] of Object.entries(attributes)) {
        span.setAttribute(key, String(value));
      }
      const result = await fn(span);
      span.setStatus({ code: 1 }); // OK
      return result;
    } catch (err: any) {
      span.setStatus({ code: 2, message: err.message }); // ERROR
      span.recordException(err);
      throw err;
    } finally {
      span.end();
    }
  });
}
