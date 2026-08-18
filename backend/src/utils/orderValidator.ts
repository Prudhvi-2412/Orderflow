export interface OrderValidationResult {
  valid: boolean;
  statusCode?: number;
  error?: string;
  data?: {
    sku: string;
    quantity: number;
    customerEmail: string;
    idempotencyKey?: string;
    lockStrategy: 'PESSIMISTIC' | 'OPTIMISTIC' | 'NONE';
  };
}

export function validateOrderPayload(body: any): OrderValidationResult {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { valid: false, statusCode: 400, error: 'Request body must be a valid JSON object' };
  }

  const { sku, quantity, customerEmail, idempotencyKey, lockStrategy } = body;

  // 1. Validate SKU
  if (sku === undefined || sku === null) {
    return { valid: false, statusCode: 400, error: 'sku is required' };
  }
  if (typeof sku !== 'string' || sku.trim().length === 0) {
    return { valid: false, statusCode: 400, error: 'sku must be a non-empty string' };
  }
  if (sku.length > 100) {
    return { valid: false, statusCode: 400, error: 'sku length must not exceed 100 characters' };
  }

  // 2. Validate quantity
  if (quantity === undefined || quantity === null || quantity === '') {
    return { valid: false, statusCode: 400, error: 'quantity is required' };
  }

  const rawQty = quantity;
  if (typeof rawQty === 'boolean' || Array.isArray(rawQty)) {
    return { valid: false, statusCode: 400, error: 'quantity must be a valid integer' };
  }

  const numQty = Number(rawQty);

  if (
    !Number.isFinite(numQty) ||
    !Number.isInteger(numQty) ||
    String(rawQty).includes('.') ||
    numQty < 1
  ) {
    return { valid: false, statusCode: 400, error: 'quantity must be a positive integer >= 1' };
  }

  const MAX_QUANTITY = 10000;
  if (numQty > MAX_QUANTITY) {
    return { valid: false, statusCode: 400, error: `quantity cannot exceed maximum allowed limit of ${MAX_QUANTITY}` };
  }

  // 3. Validate customerEmail
  if (customerEmail === undefined || customerEmail === null) {
    return { valid: false, statusCode: 400, error: 'customerEmail is required' };
  }
  if (typeof customerEmail !== 'string' || customerEmail.trim().length === 0) {
    return { valid: false, statusCode: 400, error: 'customerEmail must be a non-empty string' };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(customerEmail.trim())) {
    return { valid: false, statusCode: 400, error: 'customerEmail must be a valid email address' };
  }

  // 4. Validate lockStrategy
  const ALLOWED_LOCK_STRATEGIES = ['PESSIMISTIC', 'OPTIMISTIC', 'NONE'];
  const strategy = lockStrategy ? String(lockStrategy).toUpperCase() : 'PESSIMISTIC';
  if (!ALLOWED_LOCK_STRATEGIES.includes(strategy)) {
    return {
      valid: false,
      statusCode: 400,
      error: `lockStrategy must be one of: ${ALLOWED_LOCK_STRATEGIES.join(', ')}`
    };
  }

  // 5. Validate idempotencyKey
  if (idempotencyKey !== undefined && idempotencyKey !== null) {
    if (typeof idempotencyKey !== 'string' || idempotencyKey.trim().length === 0 || idempotencyKey.length > 255) {
      return { valid: false, statusCode: 400, error: 'idempotencyKey must be a non-empty string with length <= 255' };
    }
  }

  return {
    valid: true,
    data: {
      sku: sku.trim(),
      quantity: numQty,
      customerEmail: customerEmail.trim().toLowerCase(),
      idempotencyKey: idempotencyKey ? idempotencyKey.trim() : undefined,
      lockStrategy: strategy as 'PESSIMISTIC' | 'OPTIMISTIC' | 'NONE'
    }
  };
}
