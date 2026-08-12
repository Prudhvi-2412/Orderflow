export interface RetryOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  backoffFactor?: number;
  jitter?: boolean;
}

export async function executeWithRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const maxRetries = options.maxRetries ?? 3;
  const initialDelayMs = options.initialDelayMs ?? 200;
  const backoffFactor = options.backoffFactor ?? 2;
  const jitter = options.jitter ?? true;

  let attempt = 0;
  let delay = initialDelayMs;

  while (attempt <= maxRetries) {
    try {
      return await fn();
    } catch (err: any) {
      attempt++;
      if (attempt > maxRetries) {
        throw err;
      }

      const calculatedDelay = jitter
        ? delay * (0.5 + Math.random() * 0.5)
        : delay;

      console.warn(`[Retry Engine] Attempt ${attempt}/${maxRetries} failed (${err.message}). Retrying in ${Math.round(calculatedDelay)}ms...`);
      
      await new Promise((r) => setTimeout(r, calculatedDelay));
      delay *= backoffFactor;
    }
  }

  throw new Error('Retry limit exceeded');
}
