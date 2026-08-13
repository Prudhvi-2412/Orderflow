import { trace, Tracer, Span } from '@opentelemetry/api';
import { NodeTracerProvider, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-node';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import dotenv from 'dotenv';

dotenv.config();

const serviceName = process.env.OTEL_SERVICE_NAME || 'orderflow-distributed-engine';

const provider = new NodeTracerProvider({
  resource: new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
    [SemanticResourceAttributes.SERVICE_VERSION]: '1.0.0'
  })
});

// Custom OTLP Exporter helper for Honeycomb / Jaeger OTLP endpoint
const otlpEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318';
const honeycombApiKey = process.env.HONEYCOMB_API_KEY;

if (honeycombApiKey) {
  console.log(`📡 [OpenTelemetry] Exporting traces to Honeycomb.io (${otlpEndpoint})`);
} else {
  console.log(`📡 [OpenTelemetry] Local Tracing initialized for ${serviceName}`);
}

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
