/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';
import { checkAdminLoginLockout, recordFailedAdminLogin, resetAdminLoginAttempts, addLog } from './db.ts';

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_RAW_PASSWORD = process.env.ADMIN_PASSWORD || 'SecretCirclePassword2026!';
const JWT_SECRET = process.env.ADMIN_JWT_SECRET || crypto.randomBytes(32).toString('hex');

// Store bcrypt hash of the admin password in server memory
let adminPasswordHash = '';

// Hash admin password on startup
(async () => {
  const salt = await bcrypt.genSalt(10);
  adminPasswordHash = await bcrypt.hash(ADMIN_RAW_PASSWORD, salt);
})();

export async function loginAdmin(req: Request, res: Response) {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const { username, password } = req.body;

  // 1. Check rate-limiting lockout
  const lockout = checkAdminLoginLockout(ip);
  if (lockout.isLocked) {
    return res.status(429).json({
      error: `Too many failed login attempts. Locked out for ${Math.ceil((lockout.remainingSeconds || 0) / 60)} minutes.`,
      remainingSeconds: lockout.remainingSeconds,
    });
  }

  // 2. Validate credentials
  if (!username || !password || typeof username !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'Username and password required.' });
  }

  const isUsernameMatch = username.trim() === ADMIN_USERNAME;
  const isPasswordMatch = isUsernameMatch && (await bcrypt.compare(password, adminPasswordHash));

  if (!isUsernameMatch || !isPasswordMatch) {
    const attempt = recordFailedAdminLogin(ip);
    addLog('admin_login_failed', username || 'unknown', 'admin_portal', `Failed admin login attempt from ${ip}`, ip);

    if (attempt.lockedNow) {
      return res.status(429).json({
        error: 'Too many failed login attempts. You are locked out for 15 minutes.',
        remainingSeconds: attempt.remainingSeconds,
      });
    }

    return res.status(401).json({
      error: 'Invalid admin username or password.',
    });
  }

  // 3. Reset rate limit on success
  resetAdminLoginAttempts(ip);

  // 4. Generate short-lived JWT and CSRF token
  const csrfToken = crypto.randomBytes(16).toString('hex');
  const token = jwt.sign(
    { role: 'admin', username: ADMIN_USERNAME, csrf: csrfToken },
    JWT_SECRET,
    { expiresIn: '2h' }
  );

  // Set secure httpOnly cookie
  res.cookie('whatscircle_admin', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 2 * 60 * 60 * 1000, // 2 hours
  });

  addLog('admin_login_success', ADMIN_USERNAME, 'admin_portal', `Admin logged in successfully from ${ip}`, ip);

  return res.json({
    success: true,
    token,
    csrfToken,
    username: ADMIN_USERNAME,
  });
}

export function logoutAdmin(req: Request, res: Response) {
  res.clearCookie('whatscircle_admin');
  return res.json({ success: true, message: 'Admin logged out' });
}

export function verifyAdmin(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.whatscircle_admin || req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: Admin authentication required.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    if (decoded.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden: Insufficient privileges.' });
    }

    // CSRF verification for mutating requests
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
      const csrfHeader = req.headers['x-admin-csrf'];
      if (!csrfHeader || csrfHeader !== decoded.csrf) {
        return res.status(403).json({ error: 'Invalid or missing CSRF token.' });
      }
    }

    (req as any).admin = decoded;
    next();
  } catch {
    return res.status(401).json({ error: 'Session expired or invalid token.' });
  }
}
