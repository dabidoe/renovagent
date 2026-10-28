import { createHash, randomBytes } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { Session, User } from './models.js';

export const COOKIE = 'up_sid';
const hash = (t: string) => createHash('sha256').update(t).digest('hex');

export async function createSession(userId: string): Promise<string> {
  const token = randomBytes(32).toString('hex');
  await Session.create({ tokenHash: hash(token), userId, expiresAt: new Date(Date.now() + 30 * 24 * 3600 * 1000) });
  return token;
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = (req as Request & { cookies?: Record<string, string> }).cookies?.[COOKIE];
  if (!token) { res.status(401).json({ error: 'Sign in required' }); return; }
  const session = await Session.findOne({ tokenHash: hash(token), expiresAt: { $gt: new Date() } });
  if (!session) { res.status(401).json({ error: 'Session expired' }); return; }
  const user = await User.findById(session.userId);
  if (!user) { res.status(401).json({ error: 'Account not found' }); return; }
  (req as Request & { userId?: string }).userId = String(user._id);
  next();
}
