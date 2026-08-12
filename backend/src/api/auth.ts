import { Router } from 'express';
import { authService } from '../services/authService.js';
import { requireAuth, AuthenticatedRequest } from '../middleware/authMiddleware.js';

export const authRouter = Router();

/**
 * POST /api/auth/register
 * Body: { name, email, password }
 */
authRouter.post('/register', (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required fields' });
    }

    const result = authService.registerUser(name, email, password);
    return res.status(201).json({
      message: 'User account created successfully',
      user: result.user,
      token: result.token
    });
  } catch (err: any) {
    const status = err.statusCode || 400;
    return res.status(status).json({ error: err.message });
  }
});

/**
 * POST /api/auth/login
 * Body: { email, password }
 */
authRouter.post('/login', (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required fields' });
    }

    const result = authService.loginUser(email, password);
    return res.status(200).json({
      message: 'Authentication successful',
      user: result.user,
      token: result.token
    });
  } catch (err: any) {
    const status = err.statusCode || 401;
    return res.status(status).json({ error: err.message });
  }
});

/**
 * GET /api/auth/me
 * Protected endpoint returning active user profile
 */
authRouter.get('/me', requireAuth, (req: AuthenticatedRequest, res) => {
  return res.status(200).json({
    user: req.user
  });
});

/**
 * POST /api/auth/logout
 * Invalidate Bearer token
 */
authRouter.post('/logout', (req, res) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    authService.logoutToken(token);
  }
  return res.status(200).json({ message: 'Successfully logged out' });
});
