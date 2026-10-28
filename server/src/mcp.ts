import { createHash } from 'node:crypto';
import type { Request, Response } from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';
import { Project, Session, User } from './models.js';
import { TASKS, calcProject, crewFindings, type ProjectInputs } from './engine.js';

// Muse connects here as an MCP client. Auth: Bearer token = an app session
// token (same value as the up_sid cookie). Full OAuth authorization-server flow
// for `muse mcp login` is the documented follow-up; token auth works today via
// mcpServers headers in Muse settings.
async function userIdFor(req: Request): Promise<string | null> {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : (req as Request & { cookies?: Record<string, string> }).cookies?.up_sid;
  if (!token) return null;
  const session = await Session.findOne({ tokenHash: createHash('sha256').update(token).digest('hex'), expiresAt: { $gt: new Date() } });
  if (!session || !(await User.findById(session.userId))) return null;
  return String(session.userId);
}

function buildServer(ownerId: string) {
  const server = new McpServer({ name: 'unpermitted-ai', version: '0.2.0' });
  server.tool('list_projects', 'List the signed-in user\'s renovation projects', {}, async () => {
    const projects = await Project.find({ ownerId }).sort({ updatedAt: -1 });
    return { content: [{ type: 'text', text: JSON.stringify(projects.map((p) => ({ id: p._id, name: p.name, updatedAt: p.updatedAt })), null, 2) }] };
  });
  server.tool('get_project_plan', 'Computed BOM, grouped trips, savings, and task states for a project', { projectId: z.string() }, async ({ projectId }) => {
    const project = await Project.findOne({ _id: projectId, ownerId });
    if (!project) return { content: [{ type: 'text', text: 'Project not found' }], isError: true };
    const inputs = project.inputs as unknown as ProjectInputs;
    const owned = project.owned instanceof Map ? Object.fromEntries(project.owned) : (project.owned as Record<string, boolean>);
    const calc = calcProject(inputs, owned || {});
    const doneSet = new Set(project.doneTaskIds as string[]);
    const tasks = TASKS.map((t) => ({ ...t, status: doneSet.has(t.id) ? 'DONE' : t.deps.some((d) => !doneSet.has(d)) ? 'BLOCKED' : 'READY' }));
    return { content: [{ type: 'text', text: JSON.stringify({ project: project.name, plan: calc, tasks }, null, 2) }] };
  });
  server.tool('run_crew', 'Rule-based crew findings (Dwang/Pete/Sparky) for a project', { projectId: z.string() }, async ({ projectId }) => {
    const project = await Project.findOne({ _id: projectId, ownerId });
    if (!project) return { content: [{ type: 'text', text: 'Project not found' }], isError: true };
    const inputs = project.inputs as unknown as ProjectInputs;
    const calc = calcProject(inputs, {});
    return { content: [{ type: 'text', text: JSON.stringify(crewFindings(inputs, calc.cost), null, 2) }] };
  });
  return server;
}

export async function handleMcp(req: Request, res: Response): Promise<void> {
  const ownerId = await userIdFor(req);
  if (!ownerId) { res.status(401).json({ error: 'MCP requires a Bearer session token' }); return; }
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  await buildServer(ownerId).connect(transport);
  await transport.handleRequest(req, res, req.body);
}
