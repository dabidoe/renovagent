import { z } from 'zod';
import { id } from './common.js';
import { lengthSchema } from './planning.js';

// Room dimensions the person measured themselves. The method records how the
// numbers were taken; it never upgrades them to verified. AR and LiDAR readings
// and imported floor plans are estimates the person confirms by saving them.
export const roomMeasureMethodSchema = z.enum([
  'tape-measure',
  'phone-ar-app',
  'lidar-scan',
  'floor-plan-file',
]);
export const roomMeasureMethodLabels = {
  'tape-measure': 'Tape measure',
  'phone-ar-app': 'Phone AR measuring app',
  'lidar-scan': 'LiDAR room scan',
  'floor-plan-file': 'Imported floor plan file',
} as const satisfies Record<z.infer<typeof roomMeasureMethodSchema>, string>;

const positiveLength = lengthSchema.refine((l) => l.amount > 0, 'Length must be greater than zero');
const positiveArea = z
  .object({ amount: z.number().finite().positive().max(1e6), unit: z.enum(['m2', 'ft2']) })
  .strict();

// Fact keys the scope recipes read (see draft-scope INPUTS). Floor area and
// perimeter come from a floor plan and win over length × width, which is exact
// only for rectangular rooms.
export const roomDimensionFacts = {
  length: 'finishedLength',
  width: 'finishedWidth',
  height: 'ceilingHeight',
  area: 'floorArea',
  perimeter: 'floorPerimeter',
} as const;
export type RoomDimension = keyof typeof roomDimensionFacts;

export const roomDimensionsInputSchema = z
  .object({
    length: positiveLength.nullable(),
    width: positiveLength.nullable(),
    height: positiveLength.nullable(),
    area: positiveArea.nullable().default(null),
    perimeter: positiveLength.nullable().default(null),
    method: roomMeasureMethodSchema,
    notes: z.string().trim().max(2000),
    // Photo or plan-file evidence already attached to the project.
    photoEvidenceIds: z.array(id).max(5),
  })
  .strict()
  .refine(
    (i) => i.length || i.width || i.height || i.area || i.perimeter,
    'Enter at least one dimension',
  );
export type RoomDimensionsInput = z.input<typeof roomDimensionsInputSchema>;
export type RoomMeasureMethod = z.infer<typeof roomMeasureMethodSchema>;

// What an imported floor plan says, before the person confirms any of it.
// Metric, as in the source file. Null means the file does not establish it.
export const floorPlanSummarySchema = z
  .object({
    format: z.enum(['roomplan-capture', 'openplan3d-export']),
    floorAreaM2: z.number().positive().nullable(),
    perimeterM: z.number().positive().nullable(),
    ceilingHeightM: z.number().positive().nullable(),
    wallHeightRangeM: z.tuple([z.number(), z.number()]).nullable(),
    wallCount: z.number().int().nonnegative(),
    spaces: z.array(z.string()),
    openings: z.array(
      z.object({
        kind: z.enum(['door', 'window', 'opening']),
        widthM: z.number(),
        heightM: z.number(),
      }),
    ),
    confidence: z.object({ high: z.number(), medium: z.number(), low: z.number() }),
    notes: z.array(z.string()),
  })
  .strict();
export type FloorPlanSummary = z.infer<typeof floorPlanSummarySchema>;
