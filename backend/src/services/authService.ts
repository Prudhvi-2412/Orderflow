import crypto from 'crypto';

export interface User {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: 'admin' | 'user';
  createdAt: string;
}

export interface AuthToken {
  token: string;
  userId: string;
  expiresAt: number;
}

// In-memory store for users & tokens with fallback seed users
class AuthService {
  private users: Map<string, User> = new Map();
  private tokens: Map<string, AuthToken> = new Map();

  constructor() {
    // Seed default Enterprise Admin User
    this.seedAdminUser();
  }

  private seedAdminUser() {
    const adminEmail = 'admin@orderflow.io';
    const adminPassword = 'OrderFlow2026!';
    const passwordHash = this.hashPassword(adminPassword);

    const adminUser: User = {
      id: 'usr_admin_001',
      name: 'Enterprise System Admin',
      email: adminEmail,
      passwordHash,
      role: 'admin',
      createdAt: new Date().toISOString()
    };

    this.users.set(adminEmail.toLowerCase(), adminUser);
  }

  // Email format validation
  public validateEmail(email: string): boolean {
    if (!email || typeof email !== 'string') return false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
  }

  // Password requirements validation (min 8 chars, 1 uppercase, 1 lowercase, 1 digit, 1 special char)
  public validatePassword(password: string): { valid: boolean; reason?: string } {
    if (!password || typeof password !== 'string') {
      return { valid: false, reason: 'Password is required' };
    }
    if (password.length < 8) {
      return { valid: false, reason: 'Password must be at least 8 characters long' };
    }
    if (!/[A-Z]/.test(password)) {
      return { valid: false, reason: 'Password must contain at least one uppercase letter (A-Z)' };
    }
    if (!/[a-z]/.test(password)) {
      return { valid: false, reason: 'Password must contain at least one lowercase letter (a-z)' };
    }
    if (!/[0-9]/.test(password)) {
      return { valid: false, reason: 'Password must contain at least one numeric digit (0-9)' };
    }
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      return { valid: false, reason: 'Password must contain at least one special character (!@#$%^&*)' };
    }
    return { valid: true };
  }

  // Secure Password Hashing using HMAC SHA256 + Salt
  public hashPassword(password: string, salt: string = 'orderflow_secure_salt_2026'): string {
    return crypto.createHmac('sha256', salt).update(password).digest('hex');
  }

  // Register New User
  public registerUser(name: string, email: string, password: string): { user: Omit<User, 'passwordHash'>; token: string } {
    const trimmedEmail = email.trim().toLowerCase();

    if (!name || name.trim().length === 0) {
      throw new Error('Full Name is required');
    }

    if (!this.validateEmail(trimmedEmail)) {
      throw new Error('Invalid email address format');
    }

    const passCheck = this.validatePassword(password);
    if (!passCheck.valid) {
      throw new Error(passCheck.reason || 'Password does not meet security requirements');
    }

    if (this.users.has(trimmedEmail)) {
      const err: any = new Error('An account with this email address already exists');
      err.statusCode = 409;
      throw err;
    }

    const userId = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const passwordHash = this.hashPassword(password);

    const newUser: User = {
      id: userId,
      name: name.trim(),
      email: trimmedEmail,
      passwordHash,
      role: 'user',
      createdAt: new Date().toISOString()
    };

    this.users.set(trimmedEmail, newUser);

    const token = this.generateToken(userId);
    const { passwordHash: _, ...safeUser } = newUser;

    return { user: safeUser, token };
  }

  // Login User
  public loginUser(email: string, password: string): { user: Omit<User, 'passwordHash'>; token: string } {
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedEmail || !password) {
      const err: any = new Error('Email and Password are required');
      err.statusCode = 400;
      throw err;
    }

    if (!this.validateEmail(trimmedEmail)) {
      const err: any = new Error('Invalid email format');
      err.statusCode = 400;
      throw err;
    }

    const user = this.users.get(trimmedEmail);
    if (!user) {
      const err: any = new Error('Invalid email or password');
      err.statusCode = 401;
      throw err;
    }

    const inputHash = this.hashPassword(password);
    if (inputHash !== user.passwordHash) {
      const err: any = new Error('Invalid email or password');
      err.statusCode = 401;
      throw err;
    }

    const token = this.generateToken(user.id);
    const { passwordHash: _, ...safeUser } = user;

    return { user: safeUser, token };
  }

  // Token Generation
  public generateToken(userId: string): string {
    const token = `bearer_${userId}_${crypto.randomBytes(16).toString('hex')}`;
    const expiresAt = Date.now() + 24 * 60 * 60 * 1000; // 24 Hours

    this.tokens.set(token, {
      token,
      userId,
      expiresAt
    });

    return token;
  }

  // Token Verification
  public verifyToken(token: string): Omit<User, 'passwordHash'> | null {
    if (!token) return null;

    const authToken = this.tokens.get(token);
    if (!authToken) return null;

    if (Date.now() > authToken.expiresAt) {
      this.tokens.delete(token);
      return null;
    }

    const user = Array.from(this.users.values()).find((u) => u.id === authToken.userId);
    if (!user) return null;

    const { passwordHash: _, ...safeUser } = user;
    return safeUser;
  }

  // Logout / Invalidate Token
  public logoutToken(token: string): boolean {
    return this.tokens.delete(token);
  }

  // Clear for tests
  public clearAll() {
    this.users.clear();
    this.tokens.clear();
    this.seedAdminUser();
  }
}

export const authService = new AuthService();
