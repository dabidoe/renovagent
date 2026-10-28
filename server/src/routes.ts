import { Router, type Request, type Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { COOKIE, createSession, requireAuth } from './auth.js';
import { Project, Session, User } from './models.js';
import { TASKS, calcProject, crewFindings, type ProjectInputs } from './engine.js';
import { env } from './env.js';

export const router = Router();
const uid = (req: Request) => (req as Request & { userId?: string }).userId as string;
const credentials = z.object({ email: z.string().email(), password: z.string().min(8) });

function setCookie(res: Response, token: string) {
  res.cookie(COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: env.NODE_ENV === 'production', maxAge: 30 * 24 * 3600 * 1000, path: '/' });
}

router.post('/auth/register', async (req, res) => {
  const body = credentials.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: 'Valid email and 8+ character password required' }); return; }
  if (await User.findOne({ email: body.data.email.toLowerCase() })) { res.status(409).json({ error: 'Account already exists' }); return; }
  const user = await User.create({ email: body.data.email.toLowerCase(), passwordHash: await bcrypt.hash(body.data.password, 12) });
  setCookie(res, await createSession(String(user._id)));
  res.status(201).json({ user: { id: user._id, email: user.email } });
});

router.post('/auth/login', async (req, res) => {
  const body = credentials.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: 'Email and password required' }); return; }
  const user = await User.findOne({ email: body.data.email.toLowerCase() });
  if (!user || !user.passwordHash || !(await bcrypt.compare(body.data.password, user.passwordHash))) { res.status(401).json({ error: 'Invalid email or password' }); return; }
  setCookie(res, await createSession(String(user._id)));
  res.json({ user: { id: user._id, email: user.email } });
});

router.post('/auth/logout', async (req, res) => {
  res.clearCookie(COOKIE, { path: '/' });
  res.json({ ok: true });
});

router.post('/auth/firebase', async (req, res) => {
  const idToken = typeof req.body?.idToken === 'string' ? req.body.idToken : '';
  if (!idToken) { res.status(400).json({ error: 'idToken required' }); return; }
  const { verifyGoogleToken, firebaseReady } = await import('./firebase.js');
  if (!firebaseReady()) { res.status(501).json({ error: 'Google sign-in not configured on server (FIREBASE_* env)' }); return; }
  try {
    const identity = await verifyGoogleToken(idToken);
    if (!identity || !identity.email) { res.status(401).json({ error: 'Invalid Google token' }); return; }
    let user = await User.findOne({ $or: [{ firebaseUid: identity.uid }, { email: identity.email }] });
    if (!user) user = await User.create({ email: identity.email, firebaseUid: identity.uid });
    else if (!user.firebaseUid) { user.firebaseUid = identity.uid; await user.save(); }
    setCookie(res, await createSession(String(user._id)));
    res.json({ user: { id: user._id, email: user.email } });
  } catch { res.status(401).json({ error: 'Invalid Google token' }); }
});

router.get('/auth/me', requireAuth, async (req, res) => {
  const user = await User.findById(uid(req));
  res.json({ user: { id: user?._id, email: user?.email } });
});

const inputsPatch = z.object({
  name: z.string().min(1).max(120).optional(),
  inputs: z.object({
    L: z.number().min(3).max(40), W: z.number().min(3).max(40), stack: z.number().min(1).max(100),
    layout: z.string(), floor: z.number(), budget: z.number().min(0).max(100000),
    basement: z.boolean(), vent: z.boolean(), permit: z.boolean(),
  }).optional(),
  owned: z.record(z.boolean()).optional(),
  doneTaskIds: z.array(z.string()).optional(),
  logEntry: z.string().max(300).optional(),
}).strict();

function planOf(project: { inputs: unknown; owned: unknown; doneTaskIds: string[] }) {
  const inputs = project.inputs as unknown as ProjectInputs;
  const ownedRaw = project.owned instanceof Map ? Object.fromEntries(project.owned as Map<string, boolean>) : (project.owned as Record<string, boolean>);
  const calc = calcProject(inputs, ownedRaw || {});
  const doneSet = new Set(project.doneTaskIds);
  const tasks = TASKS.map((t) => ({ ...t, status: doneSet.has(t.id) ? 'DONE' : t.deps.some((d) => !doneSet.has(d)) ? 'BLOCKED' : 'READY' }));
  return { calc, tasks };
}

function present(project: InstanceType<typeof Project>) {
  const { calc, tasks } = planOf(project as never);
  return { id: project._id, name: project.name, inputs: project.inputs, owned: project.owned, doneTaskIds: project.doneTaskIds, log: project.log, plan: calc, tasks, updatedAt: project.updatedAt };
}

router.get('/projects', requireAuth, async (req, res) => {
  const projects = await Project.find({ ownerId: uid(req) }).sort({ updatedAt: -1 });
  res.json({ projects: projects.map(present) });
});

router.post('/projects', requireAuth, async (req, res) => {
  const project = await Project.create({ ownerId: uid(req), name: typeof req.body?.name === 'string' ? req.body.name : undefined });
  res.status(201).json({ project: present(project) });
});

router.get('/projects/:id', requireAuth, async (req, res) => {
  const project = await Project.findOne({ _id: req.params.id, ownerId: uid(req) });
  if (!project) { res.status(404).json({ error: 'Project not found' }); return; }
  res.json({ project: present(project) });
});

router.patch('/projects/:id', requireAuth, async (req, res) => {
  const body = inputsPatch.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: 'Invalid project update' }); return; }
  const project = await Project.findOne({ _id: req.params.id, ownerId: uid(req) });
  if (!project) { res.status(404).json({ error: 'Project not found' }); return; }
  if (body.data.name) project.name = body.data.name;
  if (body.data.inputs) project.inputs = body.data.inputs as never;
  if (body.data.owned) project.owned = body.data.owned as never;
  if (body.data.doneTaskIds) project.doneTaskIds = body.data.doneTaskIds as never;
  if (body.data.logEntry) { project.log = [...(project.log as string[]), body.data.logEntry].slice(-50) as never; }
  await project.save();
  res.json({ project: present(project) });
});

router.delete('/projects/:id', requireAuth, async (req, res) => {
  const deleted = await Project.findOneAndDelete({ _id: req.params.id, ownerId: uid(req) });
  if (!deleted) { res.status(404).json({ error: 'Project not found' }); return; }
  res.json({ ok: true });
});

router.post('/projects/:id/crew', requireAuth, async (req, res) => {
  const project = await Project.findOne({ _id: req.params.id, ownerId: uid(req) });
  if (!project) { res.status(404).json({ error: 'Project not found' }); return; }
  const { calc } = planOf(project as never);
  res.json({ findings: crewFindings(project.inputs as unknown as ProjectInputs, calc.cost) });
});
