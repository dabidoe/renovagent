import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { FLOOR_STYLES, namedPaint, nearestPaint, type PaintColor } from '@renovagent/core';
import type { CatalogStore } from './catalog.js';
import type { PlanRoom, StudioPlanStore } from './studio-plans.js';
import { normalizeImage, sha256Of, type DesignImageStore } from './design-images.js';
import {
  DEFAULT_SHEEN,
  PRESET_COLORS,
  money,
  roomTakeoff,
  shoppingList,
  type HouseProject,
  type RoomPick,
  type StudioRoom,
  type TierKey,
  type WallColor,
} from '../../web/src/features/house-example/paint-floor.js';

// The paint-and-floor studio for agents: the agent reads the owner's words
// and photos and chooses; these tools give it the real options (floor
// styles, loaded paint colours) and the same quantities and demo prices the
// studio shows. Read-only computation; nothing is stored.

export const STUDIO_MCP_TOOLS = ['list_floor_styles', 'find_paint_color', 'plan_paint_and_floor'];
// Registered only for a propose credential on the hosted endpoint.
export const STUDIO_SAVE_TOOLS = ['save_plan', 'save_inspiration', 'list_inspiration'];

const PRICE_NOTE =
  'Example prices for this demo, not live offers; labour is quoted separately. Quantities: wall area × 2 coats plus 10% paint, rounded up to whole gallons; floors by the room area.';

const text = (value: unknown) => ({
  content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }],
});

const colorQuery = z
  .object({
    name: z.string().trim().min(1).max(60).optional(),
    hex: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .optional(),
  })
  .refine((q) => q.name || q.hex, 'Give a paint colour name or a hex');

// A named colour only on an exact name; otherwise the closest loaded colour
// to the hex. With no brand palette loaded, the studio's starting colours.
async function resolveColor(
  catalog: CatalogStore | undefined,
  query: z.infer<typeof colorQuery>,
): Promise<(WallColor & { match: 'name' | 'nearest' }) | null> {
  const loaded: Pick<PaintColor, 'name' | 'code' | 'hex' | 'brand'>[] =
    (await catalog?.allPaint().catch(() => [])) ?? [];
  const colors = loaded.length ? loaded : PRESET_COLORS;
  const named = query.name ? namedPaint(query.name, colors) : null;
  const found = named ?? (query.hex ? nearestPaint(query.hex, colors) : null);
  return found
    ? {
        name: found.name,
        code: found.code ?? '',
        hex: found.hex.toLowerCase(),
        brand: found.brand,
        match: named ? 'name' : 'nearest',
      }
    : null;
}

const roomInput = z.object({
  name: z.string().trim().min(1).max(60),
  widthFt: z.number().min(3).max(60),
  lengthFt: z.number().min(3).max(60),
  existingFloor: z.enum(['carpet', 'hardwood', 'vinyl plank', 'tile', 'other']).default('other'),
  paint: colorQuery.nullable().default(null),
  paintLine: z.enum(['builder', 'mid', 'high']).optional(),
  sheen: z.enum(['matte', 'eggshell', 'satin']).optional(),
  floorStyle: z
    .enum(FLOOR_STYLES.map((f) => f.id) as [string, ...string[]])
    .nullable()
    .default(null),
  floorMaterial: z.enum(['lvp', 'hardwood']).default('lvp'),
});
const planInput = {
  ceilingFt: z.number().min(7).max(14),
  tier: z.enum(['builder', 'mid', 'high']).default('mid'),
  rooms: z.array(roomInput).min(1).max(12),
};

// The agent's rooms with each colour resolved to a loaded paint colour.
async function resolveRooms(
  catalog: CatalogStore | undefined,
  rooms: z.infer<typeof roomInput>[],
): Promise<PlanRoom[]> {
  const resolved: PlanRoom[] = [];
  for (const r of rooms) {
    const found = r.paint ? await resolveColor(catalog, r.paint) : null;
    resolved.push({
      name: r.name,
      widthFt: r.widthFt,
      lengthFt: r.lengthFt,
      existingFloor: r.existingFloor === 'other' ? 'floor' : r.existingFloor,
      color: found
        ? { name: found.name, code: found.code, hex: found.hex, brand: found.brand }
        : null,
      ...(r.paintLine ? { paintLine: r.paintLine } : {}),
      ...(r.sheen ? { sheen: r.sheen } : {}),
      floorStyle: r.floorStyle,
      floorMaterial: r.floorMaterial,
    });
  }
  return resolved;
}

// A plan as a studio project: rooms with no photo (the studio shows them in
// 3D) and the plan's choices as each room's starting picks.
export function studioProject(
  projectId: string,
  title: string,
  ceilingFt: number,
  tier: TierKey,
  rooms: PlanRoom[],
): HouseProject {
  const studioRooms: StudioRoom[] = rooms.map((r, i) => ({
    id: `room-${i + 1}`,
    title: r.name,
    existingFloor: r.existingFloor,
    photo: { src: '', walls: null },
    floors: {},
    size: { xFt: r.widthFt, yFt: r.lengthFt },
  }));
  const starting: Record<string, RoomPick> = Object.fromEntries(
    rooms.map((r, i) => [
      `room-${i + 1}`,
      {
        color: r.color,
        floor: r.floorStyle ? r.floorMaterial : 'keep',
        ...(r.floorStyle ? { floorStyle: r.floorStyle } : {}),
        ...(r.paintLine ? { paintLine: r.paintLine } : {}),
        sheen: r.sheen ?? DEFAULT_SHEEN,
        included: true,
      } satisfies RoomPick,
    ]),
  );
  return { id: projectId, address: title, ceilingFt, tier, rooms: studioRooms, starting };
}

// The same quantities and demo prices the studio shows for these choices.
function priced(project: HouseProject, tier: TierKey) {
  const picks = project.starting!;
  const ceilingFt = project.ceilingFt!;
  const takeoffs = Object.fromEntries(
    project.rooms.map((r) => [r.id, roomTakeoff(r, ceilingFt, picks[r.id]!, tier)]),
  );
  const list = shoppingList(project, picks, takeoffs);
  const label = (c: WallColor | null) => (c ? `${c.name}${c.code ? ` (${c.code})` : ''}` : null);
  return {
    tier,
    total: money(list.totalMinor),
    rooms: project.rooms.map((r) => ({
      name: r.title,
      paint: label(picks[r.id]!.color),
      floor: list.rooms.find((x) => x.title === r.title)?.floor ?? null,
      wallSqFt: takeoffs[r.id]!.wallSqFt,
      floorSqFt: takeoffs[r.id]!.floorSqFt,
      materials: takeoffs[r.id]!.lines.map((l) => ({
        item: l.productName,
        units: l.purchaseUnits,
        each: money(l.unitPriceMinor),
        total: money(l.lineTotalMinor),
      })),
      total: money(takeoffs[r.id]!.totalMinor),
    })),
    toBuy: list.buy.map((b) => ({ item: b.item, units: b.units, total: money(b.totalMinor) })),
    note: PRICE_NOTE,
  };
}

export type StudioToolOptions = {
  // Saving plans: a propose credential, its owner and the site's address.
  plans?: {
    store: StudioPlanStore;
    ownerId: string;
    agent: string;
    origin: string;
    images?: DesignImageStore;
  };
};

export function registerStudioTools(
  server: McpServer,
  catalog: CatalogStore | undefined,
  options: StudioToolOptions = {},
) {
  server.tool(
    'list_floor_styles',
    'The floor styles an owner can choose from (a look, not a product): id, name, description and swatch image path. A style never changes the price; the material (vinyl plank or hardwood) and tier do. Swatches are generated illustrations, not product photos.',
    {},
    { readOnlyHint: true, openWorldHint: false },
    async () =>
      text(
        FLOOR_STYLES.map((f) => ({
          id: f.id,
          name: f.label,
          description: f.description,
          swatch: `/finishes/${f.id}.jpg`,
        })),
      ),
  );

  server.tool(
    'find_paint_color',
    'Turn a paint colour name ("Naval") or a described colour as a hex into a real loaded brand colour with its code. A name is kept only on an exact match; a hex gets the closest colour by eye. Colour never changes the price.',
    { name: z.string().trim().min(1).max(60).optional(), hex: z.string().optional() },
    { readOnlyHint: true, openWorldHint: false },
    async (input) => {
      const query = colorQuery.parse(input);
      return text((await resolveColor(catalog, query)) ?? { match: null });
    },
  );

  server.tool(
    'plan_paint_and_floor',
    'Price paint and floors for rooms the agent describes: each room with its size, and optionally a wall colour (name or hex), paint line and finish, and a floor style with its material. Returns each room’s materials, a whole-house shopping list and the total, at one price tier. Computation only; nothing is stored. To give the owner a link to the plan in the studio, use save_plan with the same rooms.',
    planInput,
    { readOnlyHint: true, openWorldHint: false },
    async ({ ceilingFt, tier, rooms }) => {
      const resolved = await resolveRooms(catalog, rooms);
      return text(
        priced(studioProject('agent-plan', 'Agent plan', ceilingFt, tier, resolved), tier),
      );
    },
  );

  const saving = options.plans;
  if (saving)
    server.tool(
      'save_plan',
      'Save a paint-and-floor plan to the owner’s Renovagent account and get a link that opens it in the studio, where the owner sees each room in 3D with these colours and floors, can change them, and gets the shopping list. Same rooms as plan_paint_and_floor, plus a title and a requestId (reuse it on retries; it returns the same link). Give the owner the link. It is a proposal: only the signed-in owner can open it, and it changes nothing else.',
      {
        requestId: z.string().trim().min(8).max(120),
        title: z.string().trim().min(1).max(80),
        ...planInput,
      },
      { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      async ({ requestId, title, ceilingFt, tier, rooms }) => {
        const resolved = await resolveRooms(catalog, rooms);
        const { plan, created } = await saving.store.save({
          requestId,
          ownerId: saving.ownerId,
          agent: saving.agent,
          title,
          ceilingFt,
          tier,
          rooms: resolved,
        });
        const project = studioProject(
          `plan-${plan._id}`,
          plan.title,
          plan.ceilingFt,
          plan.tier,
          plan.rooms,
        );
        return text({
          url: `${saving.origin}/#plan/${plan._id}`,
          saved: created ? 'new' : 'already saved for this requestId',
          title: plan.title,
          ...priced(project, plan.tier),
        });
      },
    );

  if (saving)
    server.tool(
      'save_inspiration',
      'Add something to the owner’s Renovagent inspiration board: a room look they like (kind "inspiration") or a product you found (kind "product"), as a link, a photo, or both. The owner sees it in the Inspiration panel of any studio, marked as found by you and not checked, and can turn a photo into paint matches, shopping searches and a restyle of their own room. Pass a photo only when you already have its bytes (for example one the owner sent you), as base64 JPEG or PNG under about 600 KB; Renovagent never downloads links. No prices. Reuse requestId on retries.',
      {
        requestId: z.string().trim().min(8).max(120),
        kind: z.enum(['inspiration', 'product']),
        title: z.string().trim().min(1).max(200),
        url: z
          .string()
          .trim()
          .max(2000)
          .optional()
          .describe('http or https page where you found it'),
        note: z
          .string()
          .trim()
          .max(1000)
          .optional()
          .describe('Why it fits, in the owner’s words where possible'),
        photoBase64: z
          .string()
          .max(900_000)
          .regex(/^[A-Za-z0-9+/]*={0,2}$/)
          .optional(),
      },
      { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      async ({ requestId, kind, title, url, note, photoBase64 }) => {
        let imageSha256: string | undefined;
        if (photoBase64) {
          if (!saving.images) throw new Error('Photos are not available on this connection');
          const original = new Uint8Array(Buffer.from(photoBase64, 'base64'));
          const stored = await saving.images.put(saving.ownerId, await normalizeImage(original), {
            label: 'agent inspiration photo',
            originalName: title.slice(0, 120),
            originalSha256: sha256Of(original),
            permission: `given to the owner's agent (${saving.agent})`,
          });
          imageSha256 = stored.sha256;
        }
        const { find, created } = await saving.store.saveFind({
          ownerId: saving.ownerId,
          requestId,
          kind,
          title,
          ...(url ? { url } : {}),
          ...(note ? { note } : {}),
          ...(imageSha256 ? { imageSha256 } : {}),
          agent: saving.agent,
        });
        return text({
          saved: created ? 'new' : 'already saved for this requestId',
          id: find._id,
          title: find.title,
          shownAt: `${saving.origin}/#your-project`,
          note: 'Shown to the owner as found by this agent, not checked. Tell them where to find it.',
        });
      },
    );

  if (saving)
    server.tool(
      'list_inspiration',
      'List the owner’s inspiration board, newest first: links and photos saved by the owner or their agents. Use it to avoid saving duplicates and to learn their taste.',
      {},
      { readOnlyHint: true, openWorldHint: false },
      async () =>
        text(
          (await saving.store.listFinds(saving.ownerId)).map((f) => ({
            id: f._id,
            kind: f.kind,
            title: f.title,
            ...(f.url ? { url: f.url } : {}),
            ...(f.note ? { note: f.note } : {}),
            photo: !!f.imageSha256,
            addedBy: f.agent ?? 'owner',
            addedAt: f.createdAt,
          })),
        ),
    );
}
