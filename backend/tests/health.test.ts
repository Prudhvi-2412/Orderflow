import request from 'supertest';
import app from '../src/server.js';
import { pool } from '../src/config/db.js';
import { closeRedisConnection } from '../src/redis/client.js';

describe('Truthful Health & Observability Metrics Test Suite', () => {

  afterAll(async () => {
    await closeRedisConnection();
    await pool.end();
  });

  it('1-2. GET /api/health/live returns process liveness and uptime', async () => {
    const res = await request(app).get('/api/health/live');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('UP');
    expect(typeof res.body.processUptimeSeconds).toBe('number');
    expect(res.body.processUptimeSeconds).toBeGreaterThanOrEqual(0);
    expect(res.body.requestsCount).toBeUndefined();
    expect(res.body.uptime).toBeUndefined();
  });

  it('3-4. GET /api/health/ready checks database connectivity', async () => {
    const res = await request(app).get('/api/health/ready');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('READY');
    expect(res.body.database).toBe('UP');
  });

  it('5-6. GET /api/health reports truthful dependency statuses without fake metrics', async () => {
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('HEALTHY');
    expect(res.body.dependencies).toBeDefined();
    expect(res.body.dependencies.database).toBe('UP');
    expect(res.body.requestsCount).toBeUndefined();
    expect(res.body.uptime).toBeUndefined();
  });

  it('7. GET /api/services/health reports truthful service statuses without hardcoded fake metrics', async () => {
    const res = await request(app).get('/api/services/health');

    expect(res.status).toBe(200);
    expect(['HEALTHY', 'DEGRADED', 'UNAVAILABLE']).toContain(res.body.status);
    expect(typeof res.body.processUptimeSeconds).toBe('number');
    expect(Array.isArray(res.body.services)).toBe(true);

    for (const service of res.body.services) {
      expect(service.requestsCount).toBeUndefined();
      expect(service.uptime).toBeUndefined();
      expect(service.details?.activeTransactions).toBeUndefined();
      expect(service.details?.recentErrors).toBeUndefined();
      expect(['HEALTHY', 'DEGRADED', 'UNAVAILABLE']).toContain(service.status);
    }
  });

  it('8. Database failure causes readiness check to return 503 UNAVAILABLE without crashing liveness', async () => {
    const originalQuery = pool.query.bind(pool);
    jest.spyOn(pool, 'query').mockImplementation(async (text: any, params?: any) => {
      if (typeof text === 'string' && text.includes('SELECT 1')) {
        throw new Error('Database connection failed');
      }
      return originalQuery(text, params);
    });

    // Liveness remains 200 UP
    const liveRes = await request(app).get('/api/health/live');
    expect(liveRes.status).toBe(200);
    expect(liveRes.body.status).toBe('UP');

    // Readiness returns 503 UNAVAILABLE
    const readyRes = await request(app).get('/api/health/ready');
    expect(readyRes.status).toBe(503);
    expect(readyRes.body.status).toBe('UNAVAILABLE');

    jest.restoreAllMocks();
  });

  it('9. Health endpoints do not leak passwords, secrets, or internal stack traces', async () => {
    const res = await request(app).get('/api/health');
    const responseText = JSON.stringify(res.body);

    expect(responseText).not.toContain('password');
    expect(responseText).not.toContain('SECRET');
    expect(responseText).not.toContain('Stack');
  });

});
