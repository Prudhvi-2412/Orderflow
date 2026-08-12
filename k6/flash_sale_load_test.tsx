import http from 'k6/http';
import { check } from 'k6';
import { Options } from 'k6/options';

declare const __VU: number;

export const options: Options = {
  scenarios: {
    flash_sale_spike: {
      executor: 'per-vu-iterations',
      vus: 100,
      iterations: 1,
      maxDuration: '10s'
    }
  },
  thresholds: {
    http_req_duration: ['p(95)<500'],
    checks: ['rate>0.99']
  }
};

const BASE_URL = 'http://localhost:4000/api';

export function setup(): void {
  console.log('⚡ k6 Flash Sale Load Test Starting (100 Virtual Users hammering 1 stock item)...');
}

export default function (): void {
  const vuId = typeof __VU !== 'undefined' ? __VU : 1;
  const url = `${BASE_URL}/orders`;

  const payload = JSON.stringify({
    sku: 'ITEM-IPHONE-15',
    quantity: 1,
    price: 999,
    customerEmail: `vu_${vuId}@loadtest.com`,
    idempotencyKey: `idemp_k6_vu_${vuId}_${Date.now()}`,
    lockStrategy: 'PESSIMISTIC'
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': `idemp_k6_vu_${vuId}_${Date.now()}`
    }
  };

  const res = http.post(url, payload, params);

  check(res, {
    'status is 201 or 200': (r) => r.status === 201 || r.status === 200,
    'response has orderId or error': (r) => {
      const jsonRes = r.json() as Record<string, any> | null;
      return jsonRes !== null && (jsonRes.orderId !== undefined || jsonRes.error !== undefined);
    }
  });
}

export function teardown(): void {
  console.log('✅ k6 Flash Sale Load Test Completed.');
}
