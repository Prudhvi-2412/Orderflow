import { CircuitBreaker } from '../src/resilience/circuitBreaker.js';
import { chaosInjector } from '../src/resilience/chaosInjector.js';
import { paymentService } from '../src/services/paymentService.js';

describe('Resilience Engine & 3-State Circuit Breaker Tests', () => {

  beforeEach(() => {
    chaosInjector.setChaos({ failureRate: 0, forceOutage: false, latencyMs: 0 });
    paymentService.circuitBreaker.failureCount = 0;
    paymentService.circuitBreaker.state = 'CLOSED';
  });

  it('should transition from CLOSED to OPEN after reaching 3 consecutive failures', async () => {
    chaosInjector.setChaos({ forceOutage: true });

    // Failure 1
    await expect(paymentService.processPayment('ORD-1', 100, 'user@example.com')).rejects.toThrow();
    expect(paymentService.circuitBreaker.state).toBe('CLOSED');

    // Failure 2
    await expect(paymentService.processPayment('ORD-2', 100, 'user@example.com')).rejects.toThrow();
    expect(paymentService.circuitBreaker.state).toBe('CLOSED');

    // Failure 3 -> Trips to OPEN!
    await expect(paymentService.processPayment('ORD-3', 100, 'user@example.com')).rejects.toThrow();
    expect(paymentService.circuitBreaker.state).toBe('OPEN');

    // Call 4 -> Fast fails immediately!
    await expect(paymentService.processPayment('ORD-4', 100, 'user@example.com')).rejects.toThrow(/OPEN/);
  });

  it('should transition from OPEN to HALF_OPEN after reset timeout and CLOSE after successful probes', async () => {
    const cb = new CircuitBreaker({
      failureThreshold: 2,
      resetTimeoutMs: 100, // Short timeout for test
      halfOpenSuccesses: 2
    });

    let shouldFail = true;
    const dummyTask = () => cb.execute(async () => {
      if (shouldFail) throw new Error('Outage');
      return 'OK';
    });

    // Trip circuit
    await expect(dummyTask()).rejects.toThrow();
    await expect(dummyTask()).rejects.toThrow();
    expect(cb.state).toBe('OPEN');

    // Wait for reset timer
    await new Promise(r => setTimeout(r, 150));

    // Disable failure
    shouldFail = false;

    // Probe 1 in HALF_OPEN
    const res1 = await dummyTask();
    expect(res1).toBe('OK');
    expect(cb.state).toBe('HALF_OPEN');

    // Probe 2 in HALF_OPEN -> Closes Circuit!
    const res2 = await dummyTask();
    expect(res2).toBe('OK');
    expect(cb.state).toBe('CLOSED');
  });

});
