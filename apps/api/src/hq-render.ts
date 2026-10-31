import { z } from 'zod';
import { DomainError } from '@renovagent/contracts';
import { floorFinishKind, floorOutline, wallSwatch, type RoomModel } from '@renovagent/core';

// High-quality renders: the measured room model goes to the Blender job on
// Modal (modal/render_room.py), which renders it with Cycles on a GPU. The
// browser starts a render, then polls; results are returned for viewing and
// download, not saved to the project.

export type RenderService = {
  submit(model: unknown): Promise<{ id: string }>;
  result(
    id: string,
  ): Promise<
    | { status: 'running' }
    | { status: 'failed'; error: string }
    | { status: 'done'; files: Record<string, string>; device: string; blender: string }
  >;
};

export const renderInput = z
  .object({
    model: z
      .object({
        walls: z.array(z.record(z.string(), z.unknown())).min(1).max(200),
        fixtures: z.array(z.record(z.string(), z.unknown())).max(200),
        floorOutlines: z.array(z.record(z.string(), z.unknown())).max(50),
      })
      .passthrough(),
    wall: z.string().trim().min(1).max(80),
    floor: z.string().trim().min(1).max(80),
  })
  .strict();

// The same payload `npm run render:room` writes for Blender.
export function blenderPayload(input: z.infer<typeof renderInput>, samples = 128) {
  const model = input.model as unknown as RoomModel;
  return {
    ...model,
    floorOutline: floorOutline(model),
    look: {
      wallHex: wallSwatch(input.wall).hex,
      wallName: input.wall,
      floorKind: floorFinishKind(input.floor),
      floorName: input.floor,
    },
    samples,
  };
}

const callId = /^fc-[A-Za-z0-9]{10,40}$/;
export function modalRenderService(baseUrl: string, token: string): RenderService {
  const call = async (path: string, init: RequestInit = {}) => {
    let response: Response;
    try {
      response = await fetch(baseUrl.replace(/\/$/, '') + path, {
        ...init,
        headers: {
          ...(init.body ? { 'Content-Type': 'application/json' } : {}),
          'X-Renovagent-Token': token,
        },
        signal: AbortSignal.timeout(60_000),
      });
    } catch {
      throw new DomainError('VALIDATION', 'The render service is unreachable');
    }
    if (!response.ok)
      throw new DomainError(
        'VALIDATION',
        `The render service refused the request (${response.status})`,
      );
    return response.json();
  };
  return {
    async submit(model) {
      const body = (await call('/submit', { method: 'POST', body: JSON.stringify({ model }) })) as {
        id?: unknown;
      };
      if (typeof body.id !== 'string' || !callId.test(body.id))
        throw new DomainError('VALIDATION', 'The render service returned no job');
      return { id: body.id };
    },
    async result(id) {
      if (!callId.test(id)) throw new DomainError('NOT_FOUND', 'Unknown render');
      return call(`/result/${id}`);
    },
  };
}

export function renderServiceFromEnv(env: NodeJS.ProcessEnv = process.env) {
  const url = env.RENOVAGENT_RENDER_URL?.trim(),
    token = env.RENOVAGENT_RENDER_TOKEN?.trim();
  return url && token ? modalRenderService(url, token) : undefined;
}
