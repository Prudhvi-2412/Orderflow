import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/authService.js';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    name: string;
    email: string;
    role: string;
    createdAt: string;
  };
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing or invalid Authorization Bearer header' });
  }

  const token = authHeader.split(' ')[1];
  const user = authService.verifyToken(token);

  if (!user) {
    return res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
  }

  req.user = user;
  next();
}
