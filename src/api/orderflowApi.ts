const API_BASE = '/api';

export interface OrderRequestPayload {
  sku: string;
  quantity: number;
  price?: number;
  customerEmail: string;
  idempotencyKey?: string;
  lockStrategy?: 'PESSIMISTIC' | 'OPTIMISTIC' | 'NONE';
}

export async function fetchHealthStatus(): Promise<{ status: string; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/health`);
    return await res.json();
  } catch (err: any) {
    return { status: 'OFFLINE', error: err.message };
  }
}

export async function fetchStockInfo(sku: string): Promise<any | null> {
  try {
    const res = await fetch(`${API_BASE}/inventory/${sku}`);
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    return null;
  }
}

export async function createBackendOrder(orderData: OrderRequestPayload): Promise<any> {
  const { sku, quantity, price, customerEmail, idempotencyKey, lockStrategy } = orderData;

  const res = await fetch(`${API_BASE}/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey || `idemp_${Date.now()}`
    },
    body: JSON.stringify({
      sku,
      quantity,
      price,
      customerEmail,
      idempotencyKey,
      lockStrategy
    })
  });

  const data = await res.json();

  if (!res.ok && res.status !== 409 && res.status !== 422) {
    throw new Error(data.error || `HTTP ${res.status} Request Failed`);
  }

  return {
    statusCode: res.status,
    ...data
  };
}
