import cookieParser from 'cookie-parser';
import express, { type NextFunction, type Request, type Response } from 'express';
import { dbReady } from './db.js';
import { firebaseReady } from './firebase.js';
import { handleMcp } from './mcp.js';
import { router } from './routes.js';

export const app = express();
app.use(express.json({ limit: '256kb' }));
app.use(cookieParser());
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, db: dbReady() ? 'connected' : 'disconnected', googleAuth: firebaseReady() ? 'configured' : 'not-configured' });
});
app.use('/api', router);
app.all('/mcp', (req, res) => { void handleMcp(req, res); });
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'Server error' });
});
