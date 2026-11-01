import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { FLOOR_STYLES, namedPaint, nearestPaint, type PaintColor } from '@renovagent/core';
import type { CatalogStore } from './catalog.js';
import {
  DEFAULT_SHEEN,
  PRESET_COLORS,
  money,
  roomTakeoff,
  shoppingList,
  type HouseProject,
  type RoomPick,
  type StudioRoom,
  type WallColor,
} from '../../web/src/features/house-example/paint-floor.js';

// The paint-and-floor studio for agents: the agent reads the owner's words
// and photos and chooses; these tools give it the real options (floor
// styles, loaded paint colours) and the same quantities and demo prices the
// studio shows. Read-only computation; nothing is stored.

export const STUDIO_MCP_TOOLS = ['list_floor_styles', 'find_paint_color', 'plan_paint_and_floor'];

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

export function registerStudioTools(server: McpServer, catalog: CatalogStore | undefined) {
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
    'Price paint and floors for rooms the agent describes: each room with its size, and optionally a wall colour (name or hex), paint line and finish, and a floor style with its material. Returns each room’s materials, a whole-house shopping list and the total, at one price tier. Computation only; nothing is stored.',
    {
      ceilingFt: z.number().min(7).max(14),
      tier: z.enum(['builder', 'mid', 'high']).default('mid'),
      rooms: z.array(roomInput).min(1).max(12),
    },
    { readOnlyHint: true, openWorldHint: false },
    async ({ ceilingFt, tier, rooms }) => {
      const studioRooms: StudioRoom[] = [];
      const picks: Record<string, RoomPick> = {};
      const colors: Record<string, string | null> = {};
      for (const [i, r] of rooms.entries()) {
        const id = `room-${i + 1}`;
        const color = r.paint ? await resolveColor(catalog, r.paint) : null;
        colors[id] = color ? `${color.name}${color.code ? ` (${color.code})` : ''}` : null;
        studioRooms.push({
          id,
          title: r.name,
          existingFloor: r.existingFloor === 'other' ? 'floor' : r.existingFloor,
          photo: { src: '', walls: null },
          floors: {},
          size: { xFt: r.widthFt, yFt: r.lengthFt },
        });
        picks[id] = {
          color: color
            ? { name: color.name, code: color.code, hex: color.hex, brand: color.brand }
            : null,
          floor: r.floorStyle ? r.floorMaterial : 'keep',
          ...(r.floorStyle ? { floorStyle: r.floorStyle } : {}),
          ...(r.paintLine ? { paintLine: r.paintLine } : {}),
          sheen: r.sheen ?? DEFAULT_SHEEN,
          included: true,
        };
      }
      const project: HouseProject = {
        id: 'agent-plan',
        address: 'Agent plan',
        ceilingFt,
        rooms: studioRooms,
      };
      const takeoffs = Object.fromEntries(
        studioRooms.map((r) => [r.id, roomTakeoff(r, ceilingFt, picks[r.id]!, tier)]),
      );
      const list = shoppingList(project, picks, takeoffs);
      return text({
        tier,
        total: money(list.totalMinor),
        rooms: studioRooms.map((r) => ({
          name: r.title,
          paint: colors[r.id],
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
      });
    },
  );
}
