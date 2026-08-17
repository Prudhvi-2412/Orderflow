import request from 'supertest';
import app from '../src/server.js';
import { authService } from '../src/services/authService.js';
import { pool } from '../src/config/db.js';
import { closeRedisConnection } from '../src/redis/client.js';

describe('Email & Password Authentication API Suite', () => {

  afterAll(async () => {
    await closeRedisConnection();
    await pool.end();
  });

  beforeEach(() => {
    authService.clearAll();
  });

  describe('User Registration (/api/auth/register)', () => {
    it('should register a valid new user and return a token', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Sarah Connor',
          email: 'sarah.connor@cyberdyne.com',
          password: 'Password123!'
        });

      expect(res.status).toBe(201);
      expect(res.body.message).toContain('created successfully');
      expect(res.body.user).toBeDefined();
      expect(res.body.user.email).toBe('sarah.connor@cyberdyne.com');
      expect(res.body.user.name).toBe('Sarah Connor');
      expect(res.body.user.passwordHash).toBeUndefined(); // Should not leak password hash
      expect(res.body.token).toBeDefined();
      expect(res.body.token).toContain('bearer_');
    });

    it('should reject registration when required fields are missing', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com'
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('required fields');
    });

    it('should reject invalid email formats', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'John Doe',
          email: 'invalid-email-address',
          password: 'Password123!'
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Invalid email address format');
    });

    it('should reject weak passwords lacking length or complexity', async () => {
      // Less than 8 characters
      const res1 = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'John Doe',
          email: 'john@example.com',
          password: 'Pass1!'
        });
      expect(res1.status).toBe(400);
      expect(res1.body.error).toContain('at least 8 characters');

      // Missing uppercase letter
      const res2 = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'John Doe',
          email: 'john@example.com',
          password: 'password123!'
        });
      expect(res2.status).toBe(400);
      expect(res2.body.error).toContain('uppercase letter');

      // Missing special character
      const res3 = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'John Doe',
          email: 'john@example.com',
          password: 'Password123'
        });
      expect(res3.status).toBe(400);
      expect(res3.body.error).toContain('special character');
    });

    it('should reject registration for duplicate email addresses', async () => {
      await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Original User',
          email: 'duplicate@example.com',
          password: 'Password123!'
        });

      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Clone User',
          email: 'duplicate@example.com',
          password: 'Password123!'
        });

      expect(res.status).toBe(409);
      expect(res.body.error).toContain('already exists');
    });
  });

  describe('User Login (/api/auth/login)', () => {
    beforeEach(async () => {
      await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Alex Developer',
          email: 'alex.dev@orderflow.io',
          password: 'SecurePassword2026!'
        });
    });

    it('should authenticate valid user credentials and return bearer token', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'alex.dev@orderflow.io',
          password: 'SecurePassword2026!'
        });

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('successful');
      expect(res.body.user.email).toBe('alex.dev@orderflow.io');
      expect(res.body.token).toBeDefined();
    });

    it('should authenticate default seed admin user', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'admin@orderflow.io',
          password: 'OrderFlow2026!'
        });

      expect(res.status).toBe(200);
      expect(res.body.user.role).toBe('admin');
    });

    it('should reject login with wrong password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'alex.dev@orderflow.io',
          password: 'WrongPassword123!'
        });

      expect(res.status).toBe(401);
      expect(res.body.error).toContain('Invalid email or password');
    });

    it('should reject login for non-existent email', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@orderflow.io',
          password: 'SecurePassword2026!'
        });

      expect(res.status).toBe(401);
      expect(res.body.error).toContain('Invalid email or password');
    });
  });

  describe('Authenticated Session & Profile (/api/auth/me & /api/auth/logout)', () => {
    let token: string;

    beforeEach(async () => {
      const reg = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Session User',
          email: 'session@orderflow.io',
          password: 'Password2026!'
        });
      token = reg.body.token;
    });

    it('should return user profile when valid Bearer token is provided', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.user).toBeDefined();
      expect(res.body.user.email).toBe('session@orderflow.io');
    });

    it('should reject access to /api/auth/me without authorization header', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
      expect(res.body.error).toContain('Missing or invalid Authorization');
    });

    it('should reject access with invalid or forged token', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer bearer_fake_token_123');

      expect(res.status).toBe(401);
      expect(res.body.error).toContain('Invalid or expired token');
    });

    it('should invalidate token on logout', async () => {
      const logoutRes = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${token}`);

      expect(logoutRes.status).toBe(200);

      // Verify token is now invalid
      const meRes = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(meRes.status).toBe(401);
    });
  });
});
